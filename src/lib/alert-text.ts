/**
 * What an alert says, and the rule that keeps it readable.
 *
 * Three times a message reached the alerts topic that its reader could not make sense of —
 * `NEXT_REDIRECT`, a Jest worker, an IndexedDB connection closing — and each time the answer
 * was to recognise that one sentence. That can never be finished. Browsers, libraries and
 * servers can say anything at all, and a list of what they have said so far does nothing for
 * whatever they say next.
 *
 * So an alert is never *made of* what a machine said. Its opening lines are always prose
 * written in this repo — what happened, what it means for the people using the site, what to
 * do — chosen by the *kind* of fault, which is a short list this repo owns, rather than by the
 * text of the fault, which is an endless one nobody does. What the machine said still goes
 * along, because it is where a fix starts, but last, under a label, and never as the headline.
 * An error nobody has seen before arrives exactly as readable as one everybody has.
 *
 * `telegram.ts` renders every alert through here and is the only way into that topic, so
 * there is no call site that can skip it. No `server-only`: the rule is pure, and is tested
 * without a server.
 */

export interface Alert {
  /** One plain sentence: what happened. Written here — never an error message pasted in. */
  what: string;
  /** What that means for the people using the site, or for the owner. */
  meaning: string;
  /** What to do about it, including — when it is true — nothing yet. */
  action: string;
  /** Whatever a machine said. Printed last, under a label, and cut short. */
  detail?: string;
}

/** Enough of a stack or a message to start a fix from; Telegram's own ceiling is 4,096. */
const DETAIL_LIMIT = 800;

export function renderAlert({ what, meaning, action, detail }: Alert): string {
  const technical = detail?.trim();
  return [
    what,
    "",
    `What it means: ${meaning}`,
    "",
    `What to do: ${action}`,
    ...(technical
      ? ["", "Technical detail, for whoever fixes it:", technical.slice(0, DETAIL_LIMIT)]
      : []),
  ].join("\n");
}

/** A thrown value as text, for `detail` only. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Said by every fault that is ours to fix and has only been seen once so far. */
const IF_AGAIN =
  "Nothing yet if this is the only one. If it comes again, it is a bug that other people will"
  + " hit too — send this whole message to Claude to fix.";

/* ------------------------------------------------------------------ the browser */

/**
 * A crash on somebody's phone, from `/api/log`.
 *
 * `source` is which of the three nets in `report.ts` caught it, and it is the one thing known
 * for certain about what the person saw: only the error screen is ever shown to them.
 * Everything else — a rejected promise, an uncaught throw — happened out of their sight.
 */
export function browserFault(path: string, source: string, message: string): Alert {
  return {
    what: `The app hit an error on someone's phone, on ${path || "a page it did not name"}.`,
    meaning:
      source === "boundary"
        ? "They were shown the “Something went wrong” screen instead of the page. Photos"
          + " they had already taken are safe on their phone and send when they try again."
        : "They were not shown an error. Something they tapped may not have responded, or"
          + " something the app does in the background — such as sending photos — stopped"
          + " until they reopen the page.",
    action: IF_AGAIN,
    detail: `${message}\n\ncaught by: ${source || "unknown"}`,
  };
}

/* ------------------------------------------------------------------ the server */

/**
 * `routeType` is Next's own closed list of the places a request can fail — see the
 * `onRequestError` reference — so the sentence for each is written once, here. One it adds
 * later falls back to the general case rather than to its own name.
 */
const DURING: Record<string, { when: string; meaning: string }> = {
  render: {
    when: "while loading a page for someone",
    meaning: "They saw the “Something went wrong” screen instead of the page.",
  },
  action: {
    when: "when someone pressed a button that saves something",
    meaning:
      "Whatever they were trying to do most likely did not save. They were shown an error"
      + " and can try again.",
  },
  route: {
    when: "while the app was fetching or sending something in the background",
    meaning:
      "Part of a page may not have loaded, or an upload may have failed — photos waiting on"
      + " a phone are retried on their own.",
  },
  proxy: {
    when: "before a page could start loading",
    meaning: "They saw an error instead of the page.",
  },
};

export function serverFault(fault: {
  route: string;
  routeType: string;
  request: string;
  message: string;
  digest?: string;
}): Alert {
  const during = DURING[fault.routeType] ?? {
    when: "while handling a request",
    meaning: "Somebody's request failed, and they may have seen an error.",
  };

  return {
    what: `The site hit an error ${during.when} (${fault.route}).`,
    meaning: during.meaning,
    action: fault.digest
      ? `${IF_AGAIN} If a guest sends a screenshot with a code on it, it will match the one below.`
      : IF_AGAIN,
    detail: [
      fault.message,
      "",
      fault.digest ? `code on their screen: ${fault.digest}` : null,
      `request: ${fault.request} · ${fault.routeType}`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  };
}
