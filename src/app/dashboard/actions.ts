"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { eventCode } from "@/lib/codes";
import { prisma } from "@/lib/prisma";
import { computeRevealAt } from "@/lib/reveal";
import { canCreateEvents, requireHost } from "@/lib/session";
import { deleteObjects } from "@/lib/storage";
import { accessRequestSchema, createEventSchema, fieldErrors } from "@/lib/validation";

export interface ActionState {
  error?: string;
  fields?: Record<string, string>;
}

/* ------------------------------------------------------------------ beta access */

export async function requestAccessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireHost();

  const parsed = accessRequestSchema.safeParse({
    eventKind: formData.get("eventKind"),
    expectedDate: String(formData.get("expectedDate") ?? "").trim() || undefined,
    guestEstimate: String(formData.get("guestEstimate") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    note: String(formData.get("note") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  await prisma.$transaction([
    prisma.accessRequest.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed.data, status: "REQUESTED" },
      update: { ...parsed.data, status: "REQUESTED", decidedAt: null },
    }),
    prisma.user.update({ where: { id: user.id }, data: { accessStatus: "REQUESTED" } }),
  ]);

  revalidatePath("/dashboard");
  return {};
}

/* ------------------------------------------------------------------ events */

export interface CreateEventInput {
  name: string;
  type: string;
  partnerA?: string;
  partnerB?: string;
  honoreeName?: string;
  askRelation: boolean;
  maxGuests: number;
  photosPerGuest: number;
  startsAt: string;
  revealDelayHours: number;
}

export async function createEventAction(input: CreateEventInput): Promise<ActionState> {
  const user = await requireHost();
  if (!canCreateEvents(user)) {
    return { error: "Your account isn't approved to create events yet." };
  }

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const data = parsed.data;
  const startsAt = new Date(data.startsAt);
  const revealAt = computeRevealAt(startsAt, data.revealDelayHours);

  let created: { id: string } | null = null;
  // Join codes are short enough that collisions are possible; retry rather than
  // pre-checking, so the unique index stays the source of truth.
  for (let attempt = 0; attempt < 6 && !created; attempt++) {
    try {
      created = await prisma.event.create({
        data: {
          code: eventCode(),
          hostId: user.id,
          name: data.name,
          type: data.type as never,
          partnerA: data.partnerA || null,
          partnerB: data.partnerB || null,
          honoreeName: data.honoreeName || null,
          askRelation: data.askRelation,
          maxGuests: data.maxGuests,
          photosPerGuest: data.photosPerGuest,
          startsAt,
          revealDelayHours: data.revealDelayHours,
          revealAt,
        },
        select: { id: true },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
    }
  }

  if (!created) return { error: "Couldn't create the event. Please try again." };

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${created.id}`);
}

export async function revealNowAction(eventId: string): Promise<ActionState> {
  const user = await requireHost();
  const event = await prisma.event.findFirst({
    where: { id: eventId, hostId: user.id },
    select: { id: true, revealAt: true },
  });
  if (!event) return { error: "Event not found." };

  if (event.revealAt <= new Date()) return {};

  await prisma.event.update({
    where: { id: event.id },
    data: { revealAt: new Date(), revealedEarly: true },
  });

  revalidatePath(`/dashboard/events/${eventId}`);
  return {};
}

export async function deleteEventAction(eventId: string): Promise<ActionState> {
  const user = await requireHost();
  const event = await prisma.event.findFirst({
    where: { id: eventId, hostId: user.id },
    select: { id: true },
  });
  if (!event) return { error: "Event not found." };

  const photos = await prisma.photo.findMany({
    where: { eventId },
    select: { fullKey: true, previewKey: true },
  });

  // Remove the objects first: an orphaned R2 object costs money forever and is invisible,
  // whereas a row pointing at a missing object is at least diagnosable.
  await deleteObjects(photos.flatMap((p) => [p.fullKey, p.previewKey]));
  await prisma.event.delete({ where: { id: eventId } });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
