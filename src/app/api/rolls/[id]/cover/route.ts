import { UPLOAD_LIMITS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { clearRollCover, setRollCover } from "@/lib/rolls";
import { getCurrentUser } from "@/lib/session";
import { coverKey, deleteObjects, headObject, presignUpload, storageConfigured } from "@/lib/storage";
import { coverInitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * A roll's cover image, uploaded straight to R2 like photos.
 *
 *   POST   hand back a presigned PUT
 *   PUT    the bytes landed — measure them, then adopt the cover
 *   DELETE drop back to the preset gradient
 *
 * The key is always derived from the roll id, and the roll is checked against the host on every
 * verb. Not `requireHost`, which redirects; a fetch wants status codes.
 */

async function authorize(rollId: string): Promise<{ userId: string } | Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // One budget for all three verbs, checked before the ownership query.
  const over = limited(`cover:${user.id}`, 30, 60);
  if (over) return over;

  const roll = await prisma.roll.findFirst({
    where: { id: rollId, hostId: user.id },
    select: { id: true },
  });
  // Same 404 for missing and not-yours, so roll ids cannot be probed.
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

  // Signed for exactly this many bytes, so R2 enforces the ceiling.
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
    // Too big: delete it rather than leave an unreferenced object.
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
