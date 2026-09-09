import "server-only";

import type { RevealMode } from "@prisma/client";

import { type Account, refundRoll, spendRoll } from "./beta";
import { rollCode } from "./codes";
import { prisma } from "./prisma";
import { computeKeptUntil, computeRevealAt, isOpen, visiblePhotoWhere } from "./roll-access";
import { clampFinish, earliestFinish, movedStart } from "./roll-config";
import { purgeRoll } from "./retention";
import { coverKey, deleteObjects, publicUrl, storageConfigured, zipKey } from "./storage";

/**
 * A photograph only counts once it has actually landed.
 *
 * A reservation is a `PENDING` row, and counting those made every number a host reads
 * disagree with the album under it — the People sheet said someone had spent nine shots on a
 * roll showing seven of their photographs. Quota is the one question that still counts
 * reservations, and it is asked in `guest-context`, deliberately, where holding the shutter
 * down must not mint upload URLs.
 */
const photoCount = { where: { status: "READY" } } as const;

/**
 * Everything that reads or writes a roll.
 *
 * Screens never touch Prisma directly: they get plain objects from here, which keeps the
 * presentational components free of database types and means changing a query does not mean
 * editing a screen.
 */

interface CreateRollInput {
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: RevealMode;
  revealDelayHours: number;
  maxGuests: number;
  photosPerGuest: number;
  everyoneCanSee: boolean;
  coverPreset: number;
}

/**
 * Creation and spending the beta allowance are one transaction on purpose. Taking a roll off
 * somebody's allowance and then failing to insert it would charge them for nothing, and there
 * is no self-serve way to hand it back.
 */
export async function createRoll(host: Account & { name: string }, input: CreateRollInput) {
  const revealAt = computeRevealAt(input.finishesAt, input.revealMode, input.revealDelayHours);

  // A `BetaAccessError` from `spendRoll` travels straight out to the server action, which
  // turns it into the dialog offering to request access.
  return prisma.$transaction(async (tx) => {
    await spendRoll(tx, host);

    const roll = await tx.roll.create({
      data: {
        code: rollCode(),
        hostId: host.id,
        name: input.name,
        coverPreset: input.coverPreset,
        maxGuests: input.maxGuests,
        photosPerGuest: input.photosPerGuest,
        everyoneCanSee: input.everyoneCanSee,
        startsAt: input.startsAt,
        finishesAt: input.finishesAt,
        revealMode: input.revealMode,
        revealDelayHours: input.revealMode === "DELAY" ? input.revealDelayHours : 0,
        revealAt,
        keptUntil: computeKeptUntil(input.finishesAt),
      },
      select: { id: true, code: true, name: true },
    });

    /*
      The host is in their own roll from the moment it exists.

      A `Guest` row is only how film is counted, and the host shoots like anybody else — so
      making them accept an invitation to their own event was the join screen standing in
      front of their own camera button, asking for the name their account already carries.
      Written here rather than the first time they reach for the camera: a host who never
      opens the viewfinder should still be one of the people on this roll.

      In the transaction, because a roll whose host is not in it is the state this exists to
      prevent — and it is one insert against a row that was written a line ago.
    */
    await tx.guest.create({
      data: { rollId: roll.id, name: host.name, userId: host.id },
    });

    return roll;
  });
}

const rollSummary = {
  id: true,
  code: true,
  name: true,
  coverPreset: true,
  coverKey: true,
  coverVersion: true,
  startsAt: true,
  finishesAt: true,
  revealAt: true,
  revealMode: true,
  revealDelayHours: true,
  revealedEarly: true,
  everyoneCanSee: true,
  maxGuests: true,
  photosPerGuest: true,
  keptUntil: true,
  downloads: true,
} as const;

export interface RollCard {
  id: string;
  code: string;
  name: string;
  coverPreset: number;
  coverKey: string | null;
  coverVersion: number;
  startsAt: Date;
  finishesAt: Date;
  photoCount: number;
  /** Null when this is the viewer's own roll; the host's name when they were invited. */
  invitedBy: string | null;
  /**
   * Up to four signed previews for the stack of prints on the home screen. Only ever filled
   * for a finished, opened album — everything else gets an empty list and draws washes.
   */
  thumbs: string[];
}

/** How many prints the album stack shows. */
const STACK = 4;

/**
 * Every roll a person is in, hosted or attended, split by whether it is still shooting.
 *
 * The two kinds are shown together rather than in a third section of their own. The split
 * that matters on this screen is time — is there still a camera, or only an album — and a
 * roll you were invited to is no less yours for the weekend than one you paid for. What
 * differs is where a card leads: your own roll opens the host screen, with its settings and
 * its invite QR; a roll you joined opens the camera, because that is all you have there.
 */
export async function listRollsForUser(userId: string, { thumbs = true } = {}) {
  const select = {
    ...rollSummary,
    _count: { select: { guests: true, photos: photoCount } },
  } as const;

  const [hosted, joined] = await Promise.all([
    prisma.roll.findMany({
      where: { hostId: userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select,
    }),
    prisma.roll.findMany({
      // A host who also shoots their own roll has a Guest row in it, so their own rolls are
      // excluded here rather than appearing twice.
      where: {
        status: "ACTIVE",
        hostId: { not: userId },
        guests: { some: { userId } },
      },
      orderBy: { createdAt: "desc" },
      select: { ...select, host: { select: { name: true } } },
    }),
  ]);

  const cards: RollCard[] = [
    ...hosted.map((roll) => ({
      id: roll.id,
      code: roll.code,
      name: roll.name,
      coverPreset: roll.coverPreset,
      coverKey: roll.coverKey,
      coverVersion: roll.coverVersion,
      startsAt: roll.startsAt,
      finishesAt: roll.finishesAt,
      photoCount: roll._count.photos,
      invitedBy: null,
      thumbs: [],
    })),
    ...joined.map((roll) => ({
      id: roll.id,
      code: roll.code,
      name: roll.name,
      coverPreset: roll.coverPreset,
      coverKey: roll.coverKey,
      coverVersion: roll.coverVersion,
      startsAt: roll.startsAt,
      finishesAt: roll.finishesAt,
      photoCount: roll._count.photos,
      invitedBy: roll.host.name,
      thumbs: [],
    })),
  ].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  const now = new Date();

  // "Active" on the home screen means still shooting; anything past that is an album,
  // which is why this splits on the capture window rather than on the reveal.
  const active = cards.filter((roll) => now < roll.finishesAt);
  const albums = cards.filter((roll) => now >= roll.finishesAt);

  /*
    The prints on each album tile cost one photo query per open album, and the home screen no
    longer draws them — it shows the active rolls and nothing else. Asking for them there was
    a per-album round trip spent on markup that never renders.
  */
  if (thumbs) {
    await attachThumbs(albums, new Map([...hosted, ...joined].map((roll) => [roll.id, roll])), userId, now);
  }

  return { active, albums };
}

/**
 * Real photographs for the album stack, in place of stock artwork.
 *
 * The stack used to be four *shipped covers*, picked by walking the preset index — so an
 * album of somebody's wedding was represented by four pictures of other people's weddings,
 * which is the one thing a photo album must never show. These are the album's own newest
 * frames, at preview size, and there are at most four of them per finished roll.
 *
 * Two rules it must not break. A sealed album gets nothing — `isOpen` is the same seal every
 * other screen asks, and a thumbnail is as much of a leak as a full frame. And on a roll the
 * viewer merely attended, `visiblePhotoWhere` narrows the stack to their own shots unless the
 * host opened the roll to everyone.
 */
async function attachThumbs(
  albums: RollCard[],
  rows: Map<string, { id: string; everyoneCanSee: boolean } & Parameters<typeof isOpen>[0]>,
  userId: string,
  now: Date,
): Promise<void> {
  if (!storageConfigured) return;

  const open = albums.filter((card) => {
    const row = rows.get(card.id);
    return row && card.photoCount > 0 && isOpen(row, now);
  });
  if (open.length === 0) return;

  // One lookup for every guest row this person holds in these rolls, rather than one per
  // card. Their own rolls do not need it — a host sees the whole album by definition.
  const guestIds = new Map(
    (
      await prisma.guest.findMany({
        where: { userId, rollId: { in: open.map((card) => card.id) } },
        select: { id: true, rollId: true },
      })
    ).map((guest) => [guest.rollId, guest.id]),
  );

  await Promise.all(
    open.map(async (card) => {
      const row = rows.get(card.id)!;
      const guestId = guestIds.get(card.id);
      // No guest row on a roll they were invited to means they never joined and shot nothing,
      // so a private album has nothing of theirs to show.
      if (card.invitedBy && !guestId) return;

      const photos = await prisma.photo.findMany({
        where: visiblePhotoWhere(
          row,
          card.invitedBy ? { kind: "guest", guestId: guestId! } : { kind: "host" },
        ),
        orderBy: [{ takenAt: "desc" }, { id: "desc" }],
        take: STACK,
        select: { previewKey: true },
      });

      card.thumbs = photos.map((photo) => publicUrl(photo.previewKey));
    }),
  );
}

export async function getRollForHost(id: string, hostId: string) {
  return prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      ...rollSummary,
      _count: { select: { guests: true, photos: photoCount } },
    },
  });
}

/**
 * Who is on this roll, and how much film each has spent.
 *
 * The host is one of them — they are enrolled at creation and hold the same quota as anybody
 * else — so they are flagged rather than hidden. Their row is the one that cannot be removed,
 * and the one that means "nobody has actually turned up yet".
 */
export async function listParticipants(rollId: string) {
  const guests = await prisma.guest.findMany({
    where: { rollId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      roll: { select: { hostId: true } },
      userId: true,
      _count: { select: { photos: photoCount } },
    },
  });

  return guests.map((guest) => ({
    id: guest.id,
    name: guest.name,
    shotsUsed: guest._count.photos,
    isHost: guest.userId !== null && guest.userId === guest.roll.hostId,
  }));
}

/* ------------------------------------------------------------------ moving the close */

/**
 * A new closing time for a roll that has not opened yet.
 *
 * The one control a host could not touch after creation, on a screen that printed it as a
 * fact. Events run late; the shutter closed anyway, and the only lever left was revealing
 * early — which is the opposite of what somebody whose party is still going wants.
 *
 * Everything derived from the close moves with it. `revealAt` is what the seal is read
 * against and `keptUntil` is the date printed on every guest's album, so leaving either
 * behind would open a roll that is still shooting or delete one a month early. `warnedAt`
 * goes back to null because it recorded a warning about a date that no longer exists.
 *
 * Clamped rather than refused: `clampFinish` is the same function the wizard runs on every
 * keystroke, so the only caller this can bite is a replayed post.
 */
export async function updateRollFinish(
  id: string,
  hostId: string,
  finishesAt: Date,
): Promise<boolean> {
  const roll = await prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      startsAt: true,
      finishesAt: true,
      revealAt: true,
      revealMode: true,
      revealDelayHours: true,
      revealedEarly: true,
    },
  });
  if (!roll) return false;
  // Nothing left to move. The photographs are out, and a close in the future would not put
  // them back.
  if (isOpen(roll)) return false;

  /*
    Never into the past. On an `AFTER` roll the close is the reveal, so a finish backdated to
    this morning would unseal a whole afternoon of photographs on one mistyped date — the
    thing the settings sheet puts behind a confirm dialog and calls irreversible. Pulling the
    close in is still allowed, as far as the present and no further.
  */
  const floor = Math.max(earliestFinish(roll.startsAt).getTime(), Date.now());
  const closes = clampFinish(roll.startsAt, new Date(Math.max(finishesAt.getTime(), floor)));

  await prisma.roll.update({
    where: { id },
    data: {
      finishesAt: closes,
      revealAt: computeRevealAt(closes, roll.revealMode, roll.revealDelayHours),
      keptUntil: computeKeptUntil(closes),
      warnedAt: null,
    },
  });
  return true;
}

/* ------------------------------------------------------------------ moving the start */

/**
 * A new opening time, for a roll whose event has not begun.
 *
 * `movedStart` is the whole rule — window, floor and ceiling — and the settings screen asks
 * it the same question to show what a move would do, so the preview and the write cannot
 * disagree. What is left here is the consequences: everything hanging off the close moves
 * with it, exactly as `updateRollFinish` moves them.
 */
export async function updateRollStart(
  id: string,
  hostId: string,
  startsAt: Date,
): Promise<boolean> {
  const roll = await prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      startsAt: true,
      finishesAt: true,
      revealMode: true,
      revealDelayHours: true,
    },
  });
  if (!roll) return false;

  const moved = movedStart(roll, startsAt);
  if (!moved) return false;

  await prisma.roll.update({
    where: { id },
    data: {
      startsAt: moved.startsAt,
      finishesAt: moved.finishesAt,
      revealAt: computeRevealAt(moved.finishesAt, roll.revealMode, roll.revealDelayHours),
      keptUntil: computeKeptUntil(moved.finishesAt),
      warnedAt: null,
    },
  });
  return true;
}

/* ------------------------------------------------------------------ how big a roll is */

type SizeResult = "ok" | "not-found" | "below-joined";

/**
 * How many people a roll holds, and how much film each of them gets.
 *
 * Both were fixed at creation, which is the worst moment to fix them: a cap reached mid-event
 * turns people away at the door, and a host who guessed low on shots watched an evening run
 * out of film with no lever at all. Either can move in either direction — except below the
 * number of guests already standing in the roll, which would be a limit that removes people
 * who are already in.
 *
 * Lowering the shot count is allowed and takes nothing away: `shotsLeft` floors at zero, so a
 * guest who has already spent more than the new number simply has none left.
 *
 * ponytail: free while `BETA`, because nothing is charged for a roll either. Whatever takes
 * payments has to come through here.
 */
export async function setRollSize(
  id: string,
  hostId: string,
  next: { maxGuests?: number; photosPerGuest?: number },
): Promise<SizeResult> {
  const roll = await prisma.roll.findFirst({
    where: { id, hostId },
    select: { _count: { select: { guests: true } } },
  });
  if (!roll) return "not-found";
  if (next.maxGuests !== undefined && next.maxGuests < roll._count.guests) return "below-joined";

  await prisma.roll.update({ where: { id }, data: next });
  return "ok";
}

/* ------------------------------------------------------------------ taking things out */

/**
 * Bytes for photographs that are leaving, and the archive that still contains them.
 *
 * The cached ZIP is a copy of an album that has just changed, so it goes with them — the
 * download route rebuilds it on the next request. Without this a host could remove a
 * photograph from every screen in the app and still hand it out in the album download.
 */
async function dropPhotoObjects(
  rollId: string,
  photos: { fullKey: string; previewKey: string }[],
): Promise<void> {
  if (!storageConfigured || photos.length === 0) return;
  await deleteObjects([
    ...photos.flatMap((photo) => [photo.fullKey, photo.previewKey]),
    zipKey(rollId),
  ]);
}

/**
 * One photograph out of the album, for good.
 *
 * The host's, not the guest's. A guest un-taking a shot would get their quota back and could
 * shoot the roll indefinitely; the host has no quota, is the person a subject actually asks,
 * and is accountable for what the album contains. Before this the only answer to one bad
 * frame in a two-hundred-guest wedding was deleting the entire roll.
 */
export async function deleteRollPhoto(
  rollId: string,
  hostId: string,
  photoId: string,
): Promise<boolean> {
  const owned = await prisma.roll.findFirst({ where: { id: rollId, hostId }, select: { id: true } });
  if (!owned) return false;

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, rollId },
    select: { id: true, fullKey: true, previewKey: true },
  });
  if (!photo) return false;

  // Bytes first, as everywhere else: a failure here leaves a row that can be tried again,
  // rather than objects nothing knows the keys of.
  await dropPhotoObjects(rollId, [photo]);
  await prisma.photo.delete({ where: { id: photo.id } });
  return true;
}

/**
 * A guest out of the roll, with everything they shot.
 *
 * The join link is a bearer token with no expiry — anyone who photographs the QR on a table
 * is in — and until now nothing could undo that. Their name goes back into circulation with
 * them, which is right: the row is gone, so there is nothing left to collide with.
 *
 * The photo rows would cascade on their own; the objects would not, which is how a removal
 * would have quietly left a guest's whole evening in the bucket.
 */
export async function removeGuest(
  rollId: string,
  hostId: string,
  guestId: string,
): Promise<boolean> {
  const owned = await prisma.roll.findFirst({ where: { id: rollId, hostId }, select: { id: true } });
  if (!owned) return false;

  /*
    Not the host. They are enrolled in their own roll at creation, so they appear in the same
    list as everybody else — and removing themselves would delete their own photographs and
    hand their slot back to a roll they own. The screen does not offer it; this is why a
    replayed post cannot either.
  */
  const target = await prisma.guest.findFirst({
    where: { id: guestId, rollId },
    select: { userId: true },
  });
  if (!target || target.userId === hostId) return false;

  const photos = await prisma.photo.findMany({
    where: { guestId, rollId },
    select: { fullKey: true, previewKey: true },
  });
  await dropPhotoObjects(rollId, photos);

  const removed = await prisma.guest.deleteMany({ where: { id: guestId, rollId } });
  return removed.count > 0;
}

export async function updateRollInfo(id: string, hostId: string, data: {
  name: string;
  coverPreset: number;
}) {
  await prisma.roll.updateMany({ where: { id, hostId }, data });
}

/* ------------------------------------------------------------------ covers */

/**
 * The roll's own cover, or null when it is using a preset.
 *
 * Synchronous now, and that is the point rather than a tidy-up. This used to mint a
 * signature per call, and the feed route calls it on a poll every twenty seconds — so the
 * cover's `src` changed a hundred and eighty times an hour and every guest's browser
 * re-downloaded an image that had not moved. A stable URL is cached by the edge and then by
 * the browser, and costs nothing to produce.
 */
export function coverUrlFor(roll: {
  coverKey: string | null;
  coverVersion: number;
}): string | null {
  if (!roll.coverKey || !storageConfigured) return null;
  /*
    `?v=` rather than a fresh key, for the reason `Roll.coverVersion` gives: the key has to
    stay a pure function of the roll id so a purge can find it, and the query string is part
    of the cache key at the edge and in the browser regardless. So a replaced cover is a URL
    neither of them has ever seen, and the old bytes age out on their own.
  */
  return `${publicUrl(roll.coverKey)}?v=${roll.coverVersion}`;
}

/** The same for screens that list rolls. No longer async: there is nothing to await. */
export function coverUrlsFor<T extends { id: string; coverKey: string | null; coverVersion: number }>(
  rolls: T[],
): Map<string, string | null> {
  return new Map(rolls.map((roll) => [roll.id, coverUrlFor(roll)]));
}

/**
 * Adopts an already-uploaded cover. The key is recomputed here, never taken from input.
 *
 * The version is bumped on every adoption rather than only when the key changes, because the
 * key never changes — replacing a cover writes the same string back, and the only evidence
 * that the picture is a different one is this call happening at all.
 */
export async function setRollCover(id: string, hostId: string): Promise<void> {
  await prisma.roll.updateMany({
    where: { id, hostId },
    data: { coverKey: coverKey(id), coverVersion: { increment: 1 } },
  });
}

/** Drops back to the preset gradient and removes the uploaded bytes. */
export async function clearRollCover(id: string, hostId: string): Promise<void> {
  const cleared = await prisma.roll.updateMany({
    where: { id, hostId },
    data: { coverKey: null },
  });
  if (cleared.count > 0 && storageConfigured) {
    await deleteObjects([coverKey(id)]);
  }
}

export async function updateRollVisibility(id: string, hostId: string, everyoneCanSee: boolean) {
  await prisma.roll.updateMany({ where: { id, hostId }, data: { everyoneCanSee } });
}

/**
 * Moving the reveal of a roll that is still sealed.
 *
 * This is also how a roll opens early, which is why there is no longer a `revealRollNow`
 * beside it: `DURING` means a roll with no seal at all, so choosing it here is the same act
 * the "Reveal now" button used to perform — said in the host's own vocabulary, on the screen
 * that explains what each mode looks like to a guest.
 *
 * `revealedEarly` is set with it rather than left to `revealMode` alone, because the mode can
 * be changed again: without the flag, a host who opened their roll and then picked `AFTER`
 * would re-seal photographs their guests had already been shown.
 */
export async function updateRollReveal(
  id: string,
  hostId: string,
  revealMode: RevealMode,
  delayHours: number,
): Promise<boolean> {
  const roll = await prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      startsAt: true,
      finishesAt: true,
      revealAt: true,
      revealMode: true,
      revealedEarly: true,
    },
  });
  if (!roll) return false;
  // Nothing left to move: the photographs are out, and a reveal in the future would not put
  // them back.
  if (isOpen(roll)) return false;

  const hours = revealMode === "DELAY" ? delayHours : 0;
  await prisma.roll.update({
    where: { id },
    data: {
      revealMode,
      revealDelayHours: hours,
      revealAt: computeRevealAt(roll.finishesAt, revealMode, hours),
      revealedEarly: revealMode === "DURING",
    },
  });
  return true;
}

export async function deleteRoll(id: string, hostId: string) {
  // Ownership is checked here rather than inside `purgeRoll`, which the retention job also
  // calls and which has no host to check it against.
  const owned = await prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      id: true,
      startsAt: true,
      host: { select: { id: true, email: true, role: true } },
    },
  });
  if (!owned) return;

  // Through the retention module, so a host deleting a roll by hand and the nightly sweep
  // destroy exactly the same things. This used to take back the cover and orphan every
  // photograph in the roll, while both legal documents said we delete the image files.
  await purgeRoll(id);

  /*
    The allowance comes back only for a roll whose event never began, and only once the purge
    has actually succeeded.

    Deleting before the first guest arrives is somebody fixing a mistake — a typo in the name,
    the wrong Saturday — and it has cost us nothing, so charging them a roll for it is a
    penalty for tidiness. Past the start there are photographs, and the allowance bought what
    it was for. Refunding ahead of the purge would hand one back for a roll still standing.
  */
  if (owned.startsAt > new Date()) await refundRoll(owned.host);
}
