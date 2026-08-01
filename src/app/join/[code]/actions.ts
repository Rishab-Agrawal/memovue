"use server";

import { redirect } from "next/navigation";

import { setGuestCookie, signGuestToken } from "@/lib/auth";
import { nameKey, normalizeCode } from "@/lib/codes";
import { asksRelation, eventTypeConfig } from "@/lib/event-types";
import { prisma } from "@/lib/prisma";
import { eventPhase } from "@/lib/reveal";
import { fieldErrors, joinEventSchema } from "@/lib/validation";

export interface JoinState {
  error?: string;
  fields?: Record<string, string>;
  /** Set when the name is taken, so the UI can offer the "this is me" recovery path. */
  nameTaken?: boolean;
}

export async function joinAction(code: string, formData: FormData): Promise<JoinState> {
  const event = await prisma.event.findUnique({ where: { code: normalizeCode(code) } });
  if (!event) return { error: "We couldn't find that event." };

  if (eventPhase(event) === "scheduled") {
    return { error: "This event hasn't started yet." };
  }

  const parsed = joinEventSchema.safeParse({
    name: formData.get("name"),
    relationSide: String(formData.get("relationSide") ?? "") || undefined,
    relation: String(formData.get("relation") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const wantsRelation = asksRelation(event.type, event.askRelation);
  const mode = eventTypeConfig(event.type).relation;
  const { name } = parsed.data;

  if (wantsRelation && mode === "sides" && !parsed.data.relationSide) {
    return { fields: { relationSide: "Pick one to continue." } };
  }

  const key = nameKey(name);

  const existing = await prisma.guest.findUnique({
    where: { eventId_nameKey: { eventId: event.id, nameKey: key } },
    select: { id: true },
  });
  if (existing) return { nameTaken: true };

  const guestCount = await prisma.guest.count({ where: { eventId: event.id } });
  if (guestCount >= event.maxGuests) {
    return { error: "This event is full — every spot has been taken." };
  }

  let guest;
  try {
    guest = await prisma.guest.create({
      data: {
        eventId: event.id,
        name,
        nameKey: key,
        relation: wantsRelation ? (parsed.data.relation ?? null) : null,
        relationSide: wantsRelation && mode === "sides" ? (parsed.data.relationSide ?? null) : null,
      },
    });
  } catch (error) {
    // Two people typing the same name at the same moment; the unique index decides.
    if ((error as { code?: string }).code === "P2002") return { nameTaken: true };
    throw error;
  }

  await setGuestCookie(event.code, await signGuestToken(guest));
  redirect(`/e/${event.code}`);
}

/**
 * Recovery for a guest who lost their session (cleared browser, new phone).
 *
 * Bumping `tokenVersion` invalidates whatever session was live before, so a name can only
 * ever be held by one device. If someone reclaims a name that isn't theirs, the real owner
 * is signed out immediately and notices — which is a far better failure mode than a silent
 * second session sharing the same shot quota.
 */
export async function reclaimAction(code: string, name: string): Promise<JoinState> {
  const event = await prisma.event.findUnique({ where: { code: normalizeCode(code) } });
  if (!event) return { error: "We couldn't find that event." };

  const guest = await prisma.guest.findUnique({
    where: { eventId_nameKey: { eventId: event.id, nameKey: nameKey(name) } },
  });
  if (!guest) return { error: "We couldn't find that name in this event." };

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { tokenVersion: { increment: 1 } },
  });

  await setGuestCookie(event.code, await signGuestToken(updated));
  redirect(`/e/${event.code}`);
}
