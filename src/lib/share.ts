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
