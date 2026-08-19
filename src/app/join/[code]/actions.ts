"use server";

import { redirect } from "next/navigation";

import { setGuestCookie, signGuestToken } from "@/lib/auth";
import { nameKey, normalizeCode } from "@/lib/codes";
import { prisma } from "@/lib/prisma";
import { rollPhase } from "@/lib/roll-access";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors, joinRollSchema } from "@/lib/validation";

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
  const roll = await prisma.roll.findUnique({ where: { code: normalizeCode(code) } });
  if (!roll) return { error: "We couldn't find that roll." };

  const phase = rollPhase(roll);
  if (phase === "scheduled") return { error: "This roll hasn't opened yet." };

  const parsed = joinRollSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

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
  const roll = await prisma.roll.findUnique({ where: { code: normalizeCode(code) } });
  if (!roll) return { error: "We couldn't find that roll." };

  const guest = await prisma.guest.findUnique({
    where: { rollId_nameKey: { rollId: roll.id, nameKey: nameKey(name) } },
  });
  if (!guest) return { error: "We couldn't find that name in this roll." };

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
