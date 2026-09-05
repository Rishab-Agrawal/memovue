import { UPLOAD_LIMITS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { clearRollCover, setRollCover } from "@/lib/rolls";
import { getCurrentUser } from "@/lib/session";
import { coverKey, deleteObjects, headObject, presignUpload, storageConfigured } from "@/lib/storage";
import { coverInitSchema } from "@/lib/validation";

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

  /*
    One budget for the whole resource, spent here because all three verbs come through here.
    Picking a cover is POST then PUT, plus whatever re-picking somebody does before they are
    happy with it — thirty a minute is far past that, and it is what stops the two verbs that
    reach R2 from being called in a loop.

    Ahead of the ownership query on purpose: the point of a limit is to refuse before the work,
    and this is the work.
  */
  const over = limited(`cover:${user.id}`, 30, 60);
  if (over) return over;

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

  // The URL is signed for exactly this many bytes, so the ceiling is enforced by R2 refusing
  // the PUT rather than by the confirm below noticing afterwards and deleting what landed.
  const body = await request.json().catch(() => null);
  const parsed = coverInitSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const uploadUrl = await presignUpload(coverKey(id), "image/jpeg", parsed.data.bytes);
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
