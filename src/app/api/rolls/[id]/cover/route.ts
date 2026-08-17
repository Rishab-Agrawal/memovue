import { UPLOAD_LIMITS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { clearRollCover, setRollCover } from "@/lib/rolls";
import { getCurrentUser } from "@/lib/session";
import { coverKey, deleteObjects, headObject, presignUpload, storageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * A roll's cover image, in three verbs.
 *
 *   POST   hand back a presigned PUT so the browser uploads to R2 directly
 *   PUT    the bytes landed — measure them, then adopt the cover
 *   DELETE drop back to the preset gradient
 *
 * Cover bytes never pass through the app server, same as photos. The key is derived from the
 * roll id on both the upload and the confirm, so a client has nothing to point anywhere: the
 * only thing it can influence is *which roll*, and that is checked against the signed-in host
 * on every verb.
 *
 * `requireHost` is not used here — it redirects, which is right for a page and useless to a
 * fetch. These return status codes.
 */

async function authorize(rollId: string): Promise<{ userId: string } | Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const roll = await prisma.roll.findFirst({
    where: { id: rollId, hostId: user.id },
    select: { id: true },
  });
  // Same 404 whether the roll is missing or someone else's — a host has no business
  // learning which roll ids exist.
  if (!roll) return Response.json({ error: "not_found" }, { status: 404 });

  return { userId: user.id };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await authorize(id);
  if (auth instanceof Response) return auth;

  if (!storageConfigured) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }

  const limit = rateLimit(`cover:${auth.userId}:${clientIp(request)}`, 20, 60);
  if (!limit.ok) return Response.json({ error: "rate_limited" }, { status: 429 });

  const uploadUrl = await presignUpload(coverKey(id), "image/jpeg");
  return Response.json({ uploadUrl });
}

export async function PUT(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await authorize(id);
  if (auth instanceof Response) return auth;

  if (!storageConfigured) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }

  const key = coverKey(id);
  const object = await headObject(key);

  if (!object) {
    return Response.json({ error: "missing_upload" }, { status: 409 });
  }
  if (object.bytes > UPLOAD_LIMITS.coverMaxBytes) {
    // Whatever landed is too big to serve behind a title. Take it back out rather than
    // leaving an object in the bucket that nothing references.
    await deleteObjects([key]).catch(() => {});
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  await setRollCover(id, auth.userId);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await authorize(id);
  if (auth instanceof Response) return auth;

  await clearRollCover(id, auth.userId);
  return Response.json({ ok: true });
}
