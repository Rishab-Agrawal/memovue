import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { presignDownload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Signs a full-resolution read on demand and redirects to it, rather than minting
 * thousands of URLs up front for a grid the guest may only scroll a fraction of.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; photoId: string }> },
) {
  const { code, photoId } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });
  if (context.phase !== "revealed") {
    return Response.json({ error: "not_revealed" }, { status: 403 });
  }

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, eventId: context.event.id, status: "READY" },
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
