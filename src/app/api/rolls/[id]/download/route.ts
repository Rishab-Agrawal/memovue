import { ZipArchive } from "archiver";
import type { Readable } from "node:stream";
import { PassThrough, Readable as NodeReadable } from "node:stream";

import { prisma } from "@/lib/prisma";
import { UPLOAD_GRACE_HOURS, isOpen } from "@/lib/roll-access";
import { getCurrentUser } from "@/lib/session";
import { getObjectStream, headObject, presignDownload, putStream, zipKey } from "@/lib/storage";

export const dynamic = "force-dynamic";
// Building a five-figure photo count takes far longer than a default function budget.
export const maxDuration = 3600;

interface ArchivePhoto {
  id: string;
  fullKey: string;
  takenAt: Date;
  guest: { name: string };
}

/**
 * Streams the whole album as a ZIP.
 *
 * Two paths, and the difference is money rather than bytes. Once a roll can take no more
 * photographs the archive is built into R2 once and every download after that is a redirect
 * to a signed link — R2 charges nothing for egress at any volume, so a host who downloads
 * ten times costs the same as one who downloads once. Before that point the album can still
 * change, so there is nothing safe to cache and we stream it live as we always did, out
 * through the app server and its metered bandwidth.
 *
 * "Can take no more photographs" is `finishesAt` plus the upload grace, not `finishesAt`:
 * a phone that was out of signal has a day to drain its queue, and a ZIP built before that
 * window closes would be missing exactly the photographs that had the hardest journey.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorised" }, { status: 401 });

  const roll = await prisma.roll.findFirst({
    where: { id, hostId: user.id },
    select: {
      id: true,
      name: true,
      startsAt: true,
      finishesAt: true,
      revealAt: true,
      revealMode: true,
      revealedEarly: true,
    },
  });
  if (!roll) return Response.json({ error: "not_found" }, { status: 404 });

  // The host waits with everyone else unless they chose DURING — otherwise the promise
  // the guests were shown on their own screen would not be true.
  if (!isOpen(roll)) {
    return Response.json({ error: "not_revealed" }, { status: 403 });
  }

  const photos = await prisma.photo.findMany({
    where: { rollId: id, status: "READY" },
    orderBy: { takenAt: "asc" },
    select: { id: true, fullKey: true, takenAt: true, guest: { select: { name: true } } },
  });

  if (photos.length === 0) {
    return Response.json({ error: "empty" }, { status: 404 });
  }

  const filename = `${safeSegment(roll.name)}-memovue.zip`;
  const settled =
    Date.now() >= roll.finishesAt.getTime() + UPLOAD_GRACE_HOURS * 3_600_000;

  if (settled) {
    const key = zipKey(roll.id);

    if (!(await headObject(key))) {
      await buildOnce(key, photos);
    }

    return Response.redirect(
      await presignDownload(key, { expiresIn: 3600, filename }),
      307,
    );
  }

  return new Response(NodeReadable.toWeb(buildArchive(photos)) as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * Builds the archive, or joins the build already running.
 *
 * A roll has exactly one host, so this is never two people — it is one person double-tapping,
 * or holding two tabs, or retrying after a slow first attempt gave up. Without this each of
 * those starts its own pass over every photograph in the roll: same bytes at the end, twice
 * the reads and twice the memory getting there.
 *
 * In-process, like the rate limiter, and for the same reason — MemoVue runs as a single
 * container. If it ever runs as several, each would build at most once and the last would win,
 * which is still correct, just wasteful.
 */
const building = new Map<string, Promise<void>>();

function buildOnce(key: string, photos: ArchivePhoto[]): Promise<void> {
  const existing = building.get(key);
  if (existing) return existing;

  const run = putStream(key, buildArchive(photos), "application/zip").finally(() => {
    building.delete(key);
  });
  building.set(key, run);
  return run;
}

/**
 * One photo at a time, piped straight from R2, so peak memory stays at roughly one
 * photograph regardless of album size. Compression is off — JPEGs are already compressed,
 * and level 0 turns this into a pure copy.
 *
 * Returns immediately; the appending runs behind it, which is what lets the same object be
 * piped to a client or handed to a multipart upload.
 *
 * Through a `PassThrough` rather than handing the archive out directly, and that hop is
 * load-bearing. Archiver builds on `readable-stream`, the userland copy — so its prototype
 * chain reads `Transform -> Duplex -> Readable` while `instanceof require("node:stream").Readable`
 * is false. `Readable.toWeb` accepts it anyway, which is why streaming a download always
 * worked; the S3 SDK's multipart upload checks the constructor and refused it outright with
 * "Body Data is unsupported format", so every archive built into R2 failed with a 500. A
 * `PassThrough` is a real core stream and satisfies both.
 *
 * Errors are forwarded by hand because `pipe` does not forward them. Without that, a build
 * that failed halfway would end the output cleanly and publish a truncated ZIP as if it were
 * the album.
 */
function buildArchive(photos: ArchivePhoto[]): Readable {
  const archive = new ZipArchive({ zlib: { level: 0 } });
  const out = new PassThrough();

  archive.on("error", (error: Error) => out.destroy(error));
  archive.pipe(out);

  void (async () => {
    try {
      const usedNames = new Set<string>();

      for (const photo of photos) {
        const body = await getObjectStream(photo.fullKey);
        if (!body) continue;

        /*
          Grouped by photographer, and named after them too — that is how hosts go looking for
          a shot, and the folder alone does not survive the first time somebody drags a
          favourite out of it. The credit is the one piece of this album that exists nowhere
          in the file itself, so it goes in the only place that travels with it.
        */
        const who = safeSegment(photo.guest.name);
        const stem = `${who}-${timestamp(photo.takenAt)}`;
        let name = `${who}/${stem}.jpg`;
        // Two frames in the same second from the same person; the id only appears here.
        if (usedNames.has(name)) name = `${who}/${stem}-${photo.id}.jpg`;
        usedNames.add(name);

        // On Node the SDK hands back a Readable directly.
        archive.append(body as Readable, { name });
      }
      await archive.finalize();
    } catch (error) {
      archive.abort();
      out.destroy(error instanceof Error ? error : new Error(String(error)));
      console.error("ZIP build failed", error);
    }
  })();

  return out;
}

function safeSegment(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "photos"
  );
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
