import { decode, processCover } from "./image";

/** Putting a host's own image on a roll, from the browser, shared by the wizard and the edit screen. */

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
 * Decodes and shrinks a picked file. The preview shows the processed blob, so the host approves
 * exactly what is uploaded. The caller must revoke the returned URL.
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
  const init = await fetch(`/api/rolls/${rollId}/cover`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // The upload URL is signed for this exact length.
    body: JSON.stringify({ bytes: blob.size }),
  });
  if (!init.ok) fail(init.status);

  const { uploadUrl } = (await init.json()) as { uploadUrl: string };

  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  });
  if (!put.ok) throw new CoverError("The upload didn't finish. Check your connection.");

  // Until this confirm, the roll keeps its preset.
  const confirm = await fetch(`/api/rolls/${rollId}/cover`, { method: "PUT" });
  if (!confirm.ok) fail(confirm.status);
}

export async function removeCover(rollId: string): Promise<void> {
  const response = await fetch(`/api/rolls/${rollId}/cover`, { method: "DELETE" });
  if (!response.ok) fail(response.status);
}
