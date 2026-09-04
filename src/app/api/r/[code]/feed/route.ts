import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { coverUrlFor } from "@/lib/rolls";

export const dynamic = "force-dynamic";

/**
 * The state of a roll, right now. Status only — no photographs.
 *
 * This is polled every twenty seconds by every open album, so its size is multiplied by
 * every guest at the event. It used to carry every frame's blur placeholder, which made one
 * response grow with the roll: a 500-guest wedding served a hundred megabytes per poll, per
 * phone. The grid now pages through `/photos` instead, and what is left here is the handful
 * of fields that actually change while someone watches — the countdown, the counts, and
 * whether the seal has lifted.
 *
 * The seal itself is still decided here and on `/photos`, from the same `getGuestContext`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  /*
    Keyed on the guest, not the address — a signed cookie is a better name for a caller than
    an IP that a whole venue shares. The album asks three times a minute; sixty leaves room
    for a second tab, a refresh, and a phone waking up, and still bounds the two counts below
    to something a roll can absorb from every guest at once.
  */
  const over = limited(`feed:${context.guest.id}`, 60, 60);
  if (over) return over;

  const { roll, guest, phase, open, capturing, shotsLeft, shotsUsed } = context;

  const [totalPhotos, guestCount] = await Promise.all([
    prisma.photo.count({ where: { rollId: roll.id, status: "READY" } }),
    prisma.guest.count({ where: { rollId: roll.id } }),
  ]);

  return Response.json({
    phase,
    open,
    capturing,
    rollName: roll.name,
    hostName: roll.host.name,
    coverPreset: roll.coverPreset,
    // Re-signed on every poll, so the album's cover never goes stale mid-event the way a
    // URL minted once at page load would after an hour on the same screen.
    coverUrl: coverUrlFor(roll),
    everyoneCanSee: roll.everyoneCanSee,
    revealAt: roll.revealAt.toISOString(),
    finishesAt: roll.finishesAt.toISOString(),
    keptUntil: roll.keptUntil.toISOString(),
    totalPhotos,
    guestCount,
    me: {
      id: guest.id,
      name: guest.name,
      shotsLeft,
      shotsUsed,
      photosPerGuest: roll.photosPerGuest,
      // Whether this guest is an account, which is what decides if the sign-up banner in
      // the album has anything left to offer them.
      linked: guest.userId !== null,
    },
  });
}
