import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { poolFrom, poolMoves } from "@/lib/roll-config";
import { coverUrlFor } from "@/lib/rolls";

export const dynamic = "force-dynamic";

/**
 * The two numbers on this response that are the same for everybody, worked out once.
 *
 * Everything else here is already cheap — one roll, one guest row, one count over the asking
 * guest's own hundred frames at most. These two are not: they are aggregates over the whole
 * roll, and they were being computed separately for every phone at the event. Five hundred
 * guests polling three times a minute is a thousand scans a minute of the same rows for the
 * same two integers.
 *
 * Ten seconds against a twenty-second poll, so the count in the album header still moves
 * while somebody watches it. Nothing here is a permission — the seal, the visibility rule and
 * the guest's own quota are all decided per request above, from `getGuestContext`. Only the
 * two totals are shared, and they are shown to everybody in the roll regardless.
 *
 * ponytail: an in-process Map, which is the fifth thing in this app that assumes one
 * container — see the ledger in README.md. Deliberately not `use cache`: that needs
 * `cacheComponents` turned on for the whole app, and this app is twenty-six cookie-reading
 * dynamic routes that would all have to be re-audited for it. Move this to the same store as
 * the rate limiter on the day a second replica exists.
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

  // The guest count and the pool's net draw come out of one aggregate — the same scan the
  // count alone used to cost, which is why the pool rides along in here rather than asking
  // separately on a route every phone at the event polls.
  const [totalPhotos, guests] = await Promise.all([
    prisma.photo.count({ where: { rollId, status: "READY" } }),
    prisma.guest.aggregate({ where: { rollId }, _count: true, _sum: { fromPool: true } }),
  ]);
  const guestCount = guests._count;
  const drawn = guests._sum.fromPool ?? 0;

  // Swept rather than left to grow: one entry per roll polled, and a roll stops being polled
  // the night its event ends.
  for (const [key, value] of totals) {
    if (now - value.at > TOTALS_TTL_MS) totals.delete(key);
  }

  const fresh = { at: now, totalPhotos, guestCount, drawn };
  totals.set(rollId, fresh);
  return fresh;
}

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

  const { totalPhotos, guestCount, drawn } = await rollTotals(roll.id);
  const pool = poolFrom(roll, guestCount, drawn);

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
    /* Unclaimed film. The album draws it on the pool tile and reads it to decide whether a
       guest with nothing left still has a camera worth opening. */
    poolLeft: pool,
    me: {
      id: guest.id,
      name: guest.name,
      shotsLeft,
      shotsUsed,
      /* What they could draw once their own film is gone — asked with an empty camera, since
         that is the moment it applies. Zero closes the album's camera tile. */
      refill: poolMoves(roll, { ...guest, shotsLeft: 0 }, pool).take,
      photosPerGuest: roll.photosPerGuest,
      // Whether this guest is an account, which is what decides if the sign-up banner in
      // the album has anything left to offer them.
      linked: guest.userId !== null,
    },
  });
}
