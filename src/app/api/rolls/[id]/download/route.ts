import { ZipArchive } from "archiver";
import type { Readable } from "node:stream";
import { PassThrough, Readable as NodeReadable } from "node:stream";

import { ZIP_DOWNLOAD_LIMIT, ZIP_DOWNLOAD_SPENT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { acceptsUploads, isOpen } from "@/lib/roll-access";
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

/** A plain-text refusal: Save is an anchor, so the browser renders whatever this returns. */
function refuse(status: number, message: string, headers: HeadersInit = {}) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...headers },
  });
}

/**
 * The whole album as a ZIP.
 *
 * Once no more uploads can arrive (`acceptsUploads`), the archive is built into R2 once and
 * every download is a redirect to a signed link, since R2 egress is free. Before that it can
 * still change, so it streams live through the app server.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return refuse(401, "Sign in to download this album.");

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
      uploadsAllowed: true,
    },
  });
  if (!roll) return refuse(404, "That roll no longer exists.");

  // The host waits for the reveal like everyone else.
  if (!isOpen(roll)) {
    return refuse(403, "This album opens at the reveal. Nothing to download yet.");
  }

  const photos = await prisma.photo.findMany({
    where: { rollId: id, status: "READY" },
    orderBy: { takenAt: "asc" },
    select: { id: true, fullKey: true, takenAt: true, guest: { select: { name: true } } },
  });

  if (photos.length === 0) {
    return refuse(404, "Nobody took a photograph on this roll.");
  }

  /*
    Ten downloads per roll, ever: a settled album never changes, so an eleventh copy means
    something is wrong. Claimed with a conditional update so two tabs cannot both take the last.

    ponytail: a build that dies halfway still spends its slot. Give it back on `buildArchive`
    errors if hosts ever run out that way.
  */
  const claimed = await prisma.roll.updateMany({
    where: { id: roll.id, downloads: { lt: ZIP_DOWNLOAD_LIMIT } },
    data: { downloads: { increment: 1 } },
  });
  if (claimed.count === 0) return refuse(403, ZIP_DOWNLOAD_SPENT);

  const filename = `${safeSegment(roll.name)}-memovue.zip`;
  if (!acceptsUploads(roll)) {
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
 * Builds the archive, or joins the build already running for a double tap or second tab.
 *
 * ponytail: in-process, like the rate limiter. Several replicas would each build once; still correct.
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
 * One photo at a time, piped straight from R2, uncompressed (JPEGs already are).
 *
 * Through a core `PassThrough` because archiver's userland stream fails the S3 SDK's instanceof
 * check. Errors are forwarded by hand, since `pipe` does not, so a failed build never publishes
 * a truncated ZIP.
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

        // A folder per photographer.
        const who = safeSegment(photo.guest.name);
        let name = `${who}/${timestamp(photo.takenAt)}.jpg`;
        // Two frames in the same second from the same person; the id only appears here.
        if (usedNames.has(name)) name = `${who}/${timestamp(photo.takenAt)}-${photo.id}.jpg`;
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
