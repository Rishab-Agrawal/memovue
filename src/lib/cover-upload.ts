import { decode, processCover } from "./image";

/**
 * Putting a host's own image on a roll, from the browser.
 *
 * Shared by the two places a cover can be set — the creation wizard and the roll's edit
 * screen — because they are the same three steps against the same endpoint, and a second
 * copy of them would be a second place for the upload and the confirm to drift apart.
 *
 * The bytes go browser → R2 directly, so a cover upload does not occupy the app server for
 * however long a phone on venue wifi takes to push a megabyte.
 */

export class CoverError extends Error {}

const MESSAGES: Record<number, string> = {
  401: "You're signed out. Sign in and try again.",
  404: "We couldn't find that roll.",
  413: "That image is too large.",
  429: "Too many attempts. Wait a moment and try again.",
  503: "Cover uploads are unavailable right now.",
};

function fail(status: number): never {
  throw new CoverError(MESSAGES[status] ?? "We couldn't upload that cover.");
}

/**
 * Decodes and shrinks a picked file, and hands back an object URL for the preview.
 *
 * The preview points at the *processed* blob rather than the original file, so what the host
 * approves is what actually gets uploaded — a 12MP original previewed and a resized copy
 * stored can differ in ways you only notice once it's live.
 *
 * The caller owns the returned URL and must revoke it when it is replaced or unmounted.
 */
export async function prepareCover(file: File): Promise<{ blob: Blob; previewUrl: string }> {
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new CoverError("We couldn't read that image. Try a JPEG or PNG.");
  }

  const { blob } = await processCover(
    source as CanvasImageSource & { width: number; height: number },
  );
  return { blob, previewUrl: URL.createObjectURL(blob) };
}

export async function uploadCover(rollId: string, blob: Blob): Promise<void> {
  const init = await fetch(`/api/rolls/${rollId}/cover`, { method: "POST" });
  if (!init.ok) fail(init.status);

  const { uploadUrl } = (await init.json()) as { uploadUrl: string };

  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  });
  if (!put.ok) throw new CoverError("The upload didn't finish. Check your connection.");

  // Nothing points at the object until this succeeds, so a half-finished upload leaves the
  // roll on its preset rather than showing a broken image.
  const confirm = await fetch(`/api/rolls/${rollId}/cover`, { method: "PUT" });
  if (!confirm.ok) fail(confirm.status);
}

export async function removeCover(rollId: string): Promise<void> {
  const response = await fetch(`/api/rolls/${rollId}/cover`, { method: "DELETE" });
  if (!response.ok) fail(response.status);
}
