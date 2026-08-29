import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/roll-access";
import { getRollForHost } from "@/lib/rolls";
import { requireHost } from "@/lib/session";
import { presignDownload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Full-resolution bytes for the host's own viewer.
 *
 * The guest route next door does the same job but authenticates a *guest* — a cookie, or an
 * account that joined this roll. A host who never joined their own roll has neither, so it
 * could not serve them, and the host's grid consequently had nowhere to open a photograph.
 *
 * Signed here rather than in `loadRoll` because a roll can hold hundreds of photographs, and
 * minting a signed URL for every one of them on every page load would put a few hundred
 * kilobytes of expiring query string into the HTML. The grid gets presigned previews it
 * genuinely needs; only the frame actually being looked at is signed at full size.
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

  const url = await presignDownload(photo.fullKey, {
    expiresIn: 3600,
    filename: download ? `memovue-${photoId}.jpg` : undefined,
  });

  return Response.redirect(url, 307);
}
