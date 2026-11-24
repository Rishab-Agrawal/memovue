/**
 * Hands a link to somebody else: the platform's share sheet where there is one, the
 * clipboard where there is not.
 *
 * What actually happened comes back, because a button that says "Copied" when nothing was
 * copied is worse than one that says nothing. Dismissing the share sheet throws and is not a
 * failure worth reporting — it falls through to the clipboard, so the tap still leaves them
 * holding the link.
 *
 * `nav` is a parameter only so this is testable without a browser.
 */
export async function shareOrCopy(
  data: { url: string; title?: string; text?: string },
  nav: Pick<Navigator, "share" | "clipboard"> = navigator,
): Promise<"shared" | "copied" | null> {
  if (nav.share) {
    try {
      await nav.share(data);
      return "shared";
    } catch {
      /* Dismissed, or refused. The clipboard is still worth trying. */
    }
  }

  try {
    await nav.clipboard.writeText(data.url);
    return "copied";
  } catch {
    /* No clipboard either — an insecure origin, or permission denied. */
    return null;
  }
}

/**
 * Saves a PNG data URL to an iPhone's Photos, which a download never reaches: iOS files it under
 * Files. Its share sheet's "Save Image" does, so iOS gets that. Everywhere else a download is
 * already the right thing, so this returns `false` and leaves the tap to the anchor.
 *
 * Synchronous up to `share`, which iOS refuses once the tap's activation has been awaited away.
 */
export function savePngToPhotos(
  dataUrl: string,
  name: string,
  nav: Pick<Navigator, "share" | "canShare" | "userAgent" | "maxTouchPoints"> = navigator,
): boolean {
  // iPadOS asks for desktop sites as a Mac; a touchscreen gives it away.
  const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
  if (!ios) return false;

  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const files = [new File([bytes], name, { type: "image/png" })];
  if (!nav.canShare?.({ files })) return false;

  nav.share({ files }).catch(() => {
    /* Dismissed. Nothing was saved, and nothing needs saying. */
  });
  return true;
}
