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
 * Joins a roll. The name is only a caption; the cookie set at the end is what identifies a
 * camera — one browser, one guest, one quota. A signed-in guest's row also records the account,
 * so the roll follows them to other devices.
 */
export async function joinAction(code: string, formData: FormData): Promise<JoinState> {
  // Free checks before any that touch the database.
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

  // A loop backstop only: a whole wedding shares one venue IP. `maxGuests` is the real bound.
  if (!rateLimit(`join:${ip}`, 100, 600).ok) {
    return { error: "Too many people joined from this network at once. Try again in a minute." };
  }

  const { name } = parsed.data;
  const user = await getCurrentUser();

  // An account already in the roll walks back in; a second row would be a second quota.
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
    // One account submitting from two tabs: `[rollId, userId]` refuses the second, so hand back the first.
    if ((error as { code?: string }).code !== "P2002" || !user) throw error;
    guest = await prisma.guest.findFirstOrThrow({ where: { rollId: roll.id, userId: user.id } });
  }

  // The join that filled the roll tells the host, once. Awaited: the request ends on the next line.
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
