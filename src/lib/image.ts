import { UPLOAD_LIMITS } from "./constants";

/**
 * Client-side image processing. Everything happens on the phone before upload, which keeps
 * the app server out of the image path entirely and makes uploads survive bad venue wifi.
 *
 * Three derivatives come out of one capture:
 *   full    — the archive copy the host eventually downloads
 *   preview — what guests actually scroll through after the reveal
 *   blur    — a ~32px JPEG inlined as a data URL, the only thing anyone can see beforehand
 */

export interface ProcessedPhoto {
  full: Blob;
  preview: Blob;
  blurData: string;
  width: number;
  height: number;
}

function scaleToFit(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function drawTo(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable on this device.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo."))),
      "image/jpeg",
      quality,
    );
  });
}

/** Decodes a File (the `capture` input fallback path) into something drawable. */
export async function decode(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    // `from-image` respects EXIF orientation, so portrait shots don't come out sideways.
    return createImageBitmap(source, { imageOrientation: "from-image" });
  }

  const image = new Image();
  const url = URL.createObjectURL(source);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read that image."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A roll cover, from a photo the host picked out of their library.
 *
 * One derivative, not three: a cover has no archive copy to keep and nothing to seal, so
 * there is no full/preview/blur split. It is deliberately smaller than a captured photo —
 * covers are decoration behind a title, and every guest landing on the invitation pays for
 * whatever this weighs.
 *
 * No cropping. The cover renders at three different aspect ratios (a tall invitation, a
 * wide-ish header, a card in a list) and `object-fit: cover` centres it at each; baking one
 * crop in here would just be the wrong crop in the other two places.
 */
export async function processCover(
  source: CanvasImageSource & { width: number; height: number },
): Promise<{ blob: Blob; width: number; height: number }> {
  const size = scaleToFit(source.width, source.height, UPLOAD_LIMITS.coverMaxEdge);
  const blob = await toBlob(drawTo(source, size.width, size.height), UPLOAD_LIMITS.coverQuality);
  return { blob, width: size.width, height: size.height };
}

export async function processCapture(
  source: CanvasImageSource & { width: number; height: number },
): Promise<ProcessedPhoto> {
  const { width: sourceWidth, height: sourceHeight } = source;

  const fullSize = scaleToFit(sourceWidth, sourceHeight, UPLOAD_LIMITS.fullMaxEdge);
  const previewSize = scaleToFit(sourceWidth, sourceHeight, UPLOAD_LIMITS.previewMaxEdge);
  const blurSize = scaleToFit(sourceWidth, sourceHeight, 32);

  const fullCanvas = drawTo(source, fullSize.width, fullSize.height);
  const previewCanvas = drawTo(source, previewSize.width, previewSize.height);
  const blurCanvas = drawTo(source, blurSize.width, blurSize.height);

  const [full, preview] = await Promise.all([
    toBlob(fullCanvas, UPLOAD_LIMITS.fullQuality),
    toBlob(previewCanvas, UPLOAD_LIMITS.previewQuality),
  ]);

  return {
    full,
    preview,
    blurData: blurCanvas.toDataURL("image/jpeg", 0.5),
    width: fullSize.width,
    height: fullSize.height,
  };
}
