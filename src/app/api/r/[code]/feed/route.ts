import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { poolFrom, poolMoves } from "@/lib/roll-config";
import { coverUrlFor } from "@/lib/rolls";

export const dynamic = "force-dynamic";

/**
 * The two roll-wide totals, cached for ten seconds so every phone at the event polling this
 * does not rescan the same rows. Nothing here is a permission; those are decided per request.
 *
 * ponytail: an in-process Map, assuming one container. Move it to a shared store alongside the
 * rate limiter if a second replica ever exists.
 */
const TOTALS_TTL_MS = 10_000;
const totals = new Map<
  string,
  { at: number; totalPhotos: number; guestCount: number; drawn: number }
>();

async function rollTotals(rollId: string) {
  const now = Date.now();
  const cached = totals.get(rollId);
  if (cached && now - cached.at < TOTALS_TTL_MS) return cached;

  const [totalPhotos, guests] = await Promise.all([
    prisma.photo.count({ where: { rollId, status: "READY" } }),
    prisma.guest.aggregate({ where: { rollId }, _count: true, _sum: { fromPool: true } }),
  ]);
  const guestCount = guests._count;
  const drawn = guests._sum.fromPool ?? 0;

  for (const [key, value] of totals) {
    if (now - value.at > TOTALS_TTL_MS) totals.delete(key);
  }

  const fresh = { at: now, totalPhotos, guestCount, drawn };
  totals.set(rollId, fresh);
  return fresh;
}

/**
 * The state of a roll right now: status only, no photographs. Polled by every open album, so
 * it stays a few hundred bytes whatever the roll holds.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const over = limited(`feed:${context.guest.id}`, 60, 60);
  if (over) return over;

  const { roll, guest, phase, open, capturing, shotsLeft, shotsUsed } = context;

  const { totalPhotos, guestCount, drawn } = await rollTotals(roll.id);
  const pool = poolFrom(roll, guestCount, drawn);

  return Response.json({
    phase,
    open,
    capturing,
    // Whether the library is open to this roll right now.
    uploads: roll.uploadsAllowed && context.acceptsUploads,
    rollName: roll.name,
    hostName: roll.host.name,
    coverPreset: roll.coverPreset,
    coverUrl: coverUrlFor(roll),
    everyoneCanSee: roll.everyoneCanSee,
    revealAt: roll.revealAt.toISOString(),
    finishesAt: roll.finishesAt.toISOString(),
    keptUntil: roll.keptUntil.toISOString(),
    totalPhotos,
    guestCount,
    poolLeft: pool,
    me: {
      id: guest.id,
      name: guest.name,
      shotsLeft,
      shotsUsed,
      // Asked with an empty camera, since that is when a refill applies.
      refill: poolMoves(roll, { ...guest, shotsLeft: 0 }, pool).take,
      photosPerGuest: roll.photosPerGuest,
      linked: guest.userId !== null,
    },
  });
}
