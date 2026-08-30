import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/roll-access";
import { getRollForHost } from "@/lib/rolls";
import { requireHost } from "@/lib/session";
import { presignDownload, publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Full-resolution bytes for the host's own viewer.
 *
 * The guest route next door does the same job but authenticates a *guest* — a cookie, or an
 * account that joined this roll. A host who never joined their own roll has neither, so it
 * could not serve them, and the host's grid consequently had nowhere to open a photograph.
 *
 * Resolved here rather than in `loadRoll` so the full-resolution key is only handed out for
 * the frame actually being looked at. The grid gets preview URLs; this is the one route that
 * gives up an original.
 *
 * `isOpen` is checked for the same reason every other route checks it: the seal applies to the
 * host too. That is the whole product.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params;

  const user = await requireHost();
  const roll = await getRollForHost(id, user.id);
  if (!roll) return Response.json({ error: "not_found" }, { status: 404 });

  if (!isOpen(roll)) {
    return Response.json({ error: "not_revealed" }, { status: 403 });
  }

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, rollId: roll.id, status: "READY" },
    select: { fullKey: true },
  });
  if (!photo) return Response.json({ error: "not_found" }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";

  /*
    Viewing goes to the cached public URL; saving still gets a signed one.

    A public object carries no `Content-Disposition`, so a browser saving it would name every
    photograph after its key — `full.jpg`, over and over, colliding in the download folder. The
    signed URL carries the filename. Same trade the album ZIP makes: a save is fetched once,
    so caching buys nothing and the expiry is worth keeping.

    Neither branch is what enforces the seal. The checks above are.
  */
  const url = download
    ? await presignDownload(photo.fullKey, {
        expiresIn: 3600,
        filename: `memovue-${photoId}.jpg`,
      })
    : publicUrl(photo.fullKey);

  return Response.redirect(url, 307);
}
