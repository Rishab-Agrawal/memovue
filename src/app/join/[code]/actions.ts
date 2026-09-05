"use server";

import { redirect } from "next/navigation";

import { setGuestCookie, signGuestToken } from "@/lib/auth";
import { AUTOMATED_MESSAGE, MIN_RENDER_MS, looksAutomated } from "@/lib/bot-check";
import { normalizeCode } from "@/lib/codes";
import { sendRollFullNotice } from "@/lib/email";
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
}

/**
 * A name, and — if there is one — the account behind it.
 *
 * The name is a caption and never a key. It is what the other guests see beside your
 * photographs, two people at the same wedding are routinely called the same thing, and
 * nothing here compares it to anybody else's. What identifies a camera is the cookie this
 * sets at the end: one browser, one guest, one shot quota.
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
      select: { id: true, rollId: true },
    });
    if (mine) {
      await setGuestCookie(roll.code, await signGuestToken({ id: mine.id, eventId: mine.rollId }));
      redirect(`/e/${roll.code}`);
    }
  }

  const guestCount = await prisma.guest.count({ where: { rollId: roll.id } });
  if (guestCount >= roll.maxGuests) {
    return { error: "This roll is full — every spot has been taken." };
  }

  let guest;
  try {
    guest = await prisma.guest.create({
      data: { rollId: roll.id, name, userId: user?.id ?? null },
    });
  } catch (error) {
    /*
      The one collision left in this table is a single account submitting from two tabs at
      once, which `[rollId, userId]` refuses. The row that won is the one to hand back — a
      second row would be a second shot quota under the same person.
    */
    if ((error as { code?: string }).code !== "P2002" || !user) throw error;
    guest = await prisma.guest.findFirstOrThrow({ where: { rollId: roll.id, userId: user.id } });
  }

  /*
    The join that filled the roll tells the host, once.

    No column to remember it and none needed: every later attempt is refused above before it
    reaches here, and raising the limit is exactly what should arm it again. Awaited rather
    than left floating, because `send` swallows its own failures and the request ends on the
    next line — this is the one message that is worth a host's evening.
  */
  if (guestCount + 1 >= roll.maxGuests) {
    const host = await prisma.user.findUnique({
      where: { id: roll.hostId },
      select: { email: true },
    });
    if (host) await sendRollFullNotice(host.email, roll.name, roll.maxGuests);
  }

  await setGuestCookie(roll.code, await signGuestToken({ id: guest.id, eventId: guest.rollId }));
  redirect(`/e/${roll.code}`);
}
