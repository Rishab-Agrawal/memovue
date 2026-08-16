"use server";

import { redirect } from "next/navigation";

import { setGuestCookie, signGuestToken } from "@/lib/auth";
import { nameKey, normalizeCode } from "@/lib/codes";
import { prisma } from "@/lib/prisma";
import { rollPhase } from "@/lib/roll-access";
import { fieldErrors, joinRollSchema } from "@/lib/validation";

export interface JoinState {
  error?: string;
  fields?: Record<string, string>;
  /** Set when the name is taken, so the UI can offer the "this is me" recovery path. */
  nameTaken?: boolean;
}

/**
 * A name and nothing else.
 *
 * The old version also asked which side of a wedding a guest was on, or how they knew the
 * birthday person — questions that existed because rolls had types. They don't any more, and
 * the join screen is one field shorter for it.
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
      data: { rollId: roll.id, name, nameKey: key },
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
 */
export async function reclaimAction(code: string, name: string): Promise<JoinState> {
  const roll = await prisma.roll.findUnique({ where: { code: normalizeCode(code) } });
  if (!roll) return { error: "We couldn't find that roll." };

  const guest = await prisma.guest.findUnique({
    where: { rollId_nameKey: { rollId: roll.id, nameKey: nameKey(name) } },
  });
  if (!guest) return { error: "We couldn't find that name in this roll." };

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { tokenVersion: { increment: 1 } },
  });

  await setGuestCookie(roll.code, await signGuestToken({ ...updated, eventId: updated.rollId }));
  redirect(`/e/${roll.code}`);
}
