import { ZipArchive } from "archiver";
import type { Readable } from "node:stream";
import { Readable as NodeReadable } from "node:stream";

import { prisma } from "@/lib/prisma";
import { isRevealed } from "@/lib/reveal";
import { getCurrentUser } from "@/lib/session";
import { getObjectStream } from "@/lib/storage";

export const dynamic = "force-dynamic";
// Streaming a five-figure photo count takes far longer than a default function budget.
export const maxDuration = 3600;

/**
 * Streams the whole album as a ZIP.
 *
 * Entries are added one at a time and piped straight from R2 to the client, so peak memory
 * stays at roughly one photo regardless of album size. Compression is off — JPEGs are
 * already compressed, and level 0 turns this into a pure copy.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorised" }, { status: 401 });

  const event = await prisma.event.findFirst({
    where: { id, hostId: user.id },
    select: { id: true, name: true, startsAt: true, revealAt: true },
  });
  if (!event) return Response.json({ error: "not_found" }, { status: 404 });

  // The host waits with everyone else — otherwise the promise the guests were given
  // ("nobody sees anything until reveal") isn't actually true.
  if (!isRevealed(event)) {
    return Response.json({ error: "not_revealed" }, { status: 403 });
  }

  const photos = await prisma.photo.findMany({
    where: { eventId: id, status: "READY" },
    orderBy: { takenAt: "asc" },
    select: { id: true, fullKey: true, takenAt: true, guest: { select: { name: true } } },
  });

  if (photos.length === 0) {
    return Response.json({ error: "empty" }, { status: 404 });
  }

  const archive = new ZipArchive({ zlib: { level: 0 } });

  void (async () => {
    try {
      const usedNames = new Set<string>();

      for (const photo of photos) {
        const body = await getObjectStream(photo.fullKey);
        if (!body) continue;

        // Grouped by photographer — that's how hosts actually go looking for a shot.
        const folder = safeSegment(photo.guest.name);
        let name = `${folder}/${timestamp(photo.takenAt)}.jpg`;
        if (usedNames.has(name)) name = `${folder}/${timestamp(photo.takenAt)}-${photo.id}.jpg`;
        usedNames.add(name);

        // On Node the SDK hands back a Readable directly.
        archive.append(body as Readable, { name });
      }
      await archive.finalize();
    } catch (error) {
      archive.abort();
      console.error("ZIP build failed", error);
    }
  })();

  return new Response(NodeReadable.toWeb(archive) as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${safeSegment(event.name)}-memovue.zip"`,
      "cache-control": "no-store",
    },
  });
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
