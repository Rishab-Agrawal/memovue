"use server";

import { redirect } from "next/navigation";

import { setGuestCookie, signGuestToken } from "@/lib/auth";
import { AUTOMATED_MESSAGE, MIN_RENDER_MS, looksAutomated } from "@/lib/bot-check";
import { nameKey, normalizeCode } from "@/lib/codes";
import { prisma } from "@/lib/prisma";
import { callerIp, outOfGuesses, rateLimit, wrongGuess } from "@/lib/ratelimit";
import { rollPhase } from "@/lib/roll-access";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors, joinRollSchema } from "@/lib/validation";

/** One message for a code that never existed and for one this caller has stopped earning. */
const NO_SUCH_ROLL = "We couldn't find that roll.";

export interface JoinState {
  error?: string;
  fields?: Record<string, string>;
  /** Set when the name is taken, so the UI can offer the "this is me" recovery path. */
  nameTaken?: boolean;
}

/**
 * A name, and — if there is one — the account behind it.
 *
 * A signed-in guest gets the same screen and the same camera as everyone else; the account
 * only changes what happens afterwards. The `Guest` row records who they were, so the roll
 * reaches their own home screen and a second device recognises them without a cookie.
 */
export async function joinAction(code: string, formData: FormData): Promise<JoinState> {
  // Free checks before any of the paid ones: neither of these touches the database. The
  // floor is the door's, not the beta form's — see `MIN_RENDER_MS` for why it is so low.
  const signals = {
    trap: String(formData.get("trap") ?? ""),
    elapsedMs: Number(formData.get("elapsedMs")),
  };
  if (looksAutomated(signals, MIN_RENDER_MS)) return { error: AUTOMATED_MESSAGE };

  const ip = await callerIp();
  if (outOfGuesses(ip)) return { error: NO_SUCH_ROLL };

  const roll = await prisma.roll.findUnique({ where: { code: normalizeCode(code) } });
  if (!roll) {
    wrongGuess(ip);
    return { error: NO_SUCH_ROLL };
  }

  const phase = rollPhase(roll);
  if (phase === "scheduled") return { error: "This roll hasn't opened yet." };

  const parsed = joinRollSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  /*
    A ceiling on joins from one address, set high enough that it is a backstop and not a door.

    A five-hundred-guest wedding is five hundred phones on one venue router, all scanning the
    card on their table within the same twenty minutes, and every one of them shares this IP.
    So this number cannot be tuned to "how many people plausibly join" — it is only here to
    stop a loop, and `maxGuests` is what actually bounds how many rows a roll can ever hold.
  */
  if (!rateLimit(`join:${ip}`, 100, 600).ok) {
    return { error: "Too many people joined from this network at once. Try again in a minute." };
  }

  const { name } = parsed.data;
  const key = nameKey(name);
  const user = await getCurrentUser();

  /*
    An account that has already joined walks back in rather than joining twice.

    The page redirects before ever showing this form, so reaching here means a resubmitted
    or replayed post — but a second row would mean a second shot quota and photos split
    across two names, so it is refused here too rather than trusted to the screen.
  */
  if (user) {
    const mine = await prisma.guest.findFirst({
      where: { rollId: roll.id, userId: user.id },
      select: { id: true, rollId: true, tokenVersion: true },
    });
    if (mine) {
      await setGuestCookie(roll.code, await signGuestToken({ ...mine, eventId: mine.rollId }));
      redirect(`/e/${roll.code}`);
    }
  }

  const existing = await prisma.guest.findUnique({
    where: { rollId_nameKey: { rollId: roll.id, nameKey: key } },
    select: { id: true },
  });
  if (existing) return { nameTaken: true };

  const guestCount = await prisma.guest.count({ where: { rollId: roll.id } });
  if (guestCount >= roll.maxGuests) {
    return { error: "This roll is full — every spot has been taken." };
  }

  let guest;
  try {
    guest = await prisma.guest.create({
      data: { rollId: roll.id, name, nameKey: key, userId: user?.id ?? null },
    });
  } catch (error) {
    // Two people typing the same name at the same moment; the unique index decides.
    if ((error as { code?: string }).code === "P2002") return { nameTaken: true };
    throw error;
  }

  await setGuestCookie(roll.code, await signGuestToken({ ...guest, eventId: guest.rollId }));
  redirect(`/e/${roll.code}`);
}

/**
 * Recovery for a guest who lost their session (cleared browser, new phone).
 *
 * Bumping `tokenVersion` invalidates whatever session was live before, so a name can only
 * ever be held by one device. If someone reclaims a name that isn't theirs, the real owner is
 * signed out immediately and notices — a far better failure mode than a silent second
 * session quietly sharing the same shot quota.
 *
 * A name already held by an account is the exception, and is refused outright. That guest has
 * a credential better than a typed name and does not need this path, so the only person it
 * could serve is someone taking a name that is not theirs.
 */
export async function reclaimAction(code: string, name: string): Promise<JoinState> {
  /*
    The tightest limit in the app, because this is the only route that takes a session away
    from somebody.

    A name is not a secret — an open roll prints them beside the photographs — so what stands
    between a stranger and a guest's camera is that they have to type one. Typing many is
    what this stops. Every attempt is counted, not only the wrong ones: unlike a roll code,
    a correct answer here is exactly what the attack looks like, and one person recovering a
    lost session does it once.
  */
  const ip = await callerIp();
  if (outOfGuesses(ip) || !rateLimit(`reclaim:${ip}`, 5, 600).ok) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const roll = await prisma.roll.findUnique({ where: { code: normalizeCode(code) } });
  if (!roll) {
    wrongGuess(ip);
    return { error: NO_SUCH_ROLL };
  }

  const guest = await prisma.guest.findUnique({
    where: { rollId_nameKey: { rollId: roll.id, nameKey: nameKey(name) } },
  });
  if (!guest) {
    wrongGuess(ip);
    return { error: "We couldn't find that name in this roll." };
  }

  const user = await getCurrentUser();

  if (guest.userId && guest.userId !== user?.id) {
    return { error: "That name belongs to someone else's account." };
  }

  // An account holder claiming an anonymous name takes it into their account, so the roll
  // reaches their home screen and the next device recognises them without this dance.
  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { tokenVersion: { increment: 1 }, ...(user ? { userId: user.id } : {}) },
  });

  await setGuestCookie(roll.code, await signGuestToken({ ...updated, eventId: updated.rollId }));
  redirect(`/e/${roll.code}`);
}
