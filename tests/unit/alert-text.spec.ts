import { expect, test } from "@playwright/test";

import { browserFault, renderAlert, serverFault } from "@/lib/alert-text";

/**
 * Every alert reads plainly without anybody having recognised the error inside it.
 *
 * Tested with errors nobody has written a word about, because that is the only kind worth
 * testing: a message this repo had already seen would pass under any rule, including the
 * list-of-known-strings rule that failed three times. The last one here is nonsense on purpose.
 */
const NEVER_SEEN = [
  "Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",
  "Jest worker encountered 2 child process exceptions, exceeding retry limit",
  "NEXT_REDIRECT",
  "xq9: unknown fault 0x7f3a in ¿∆",
];

const LABEL = "Technical detail, for whoever fixes it:";

test("an error nobody has seen still arrives in plain words, with the raw text kept below", () => {
  for (const message of NEVER_SEEN) {
    const alerts = [
      // The three nets in `report.ts`, and one it might grow later.
      ...["window", "promise", "boundary", "something-new"].map((source) =>
        browserFault("/rolls/abc", source, message),
      ),
      // Next's own list of where a request fails, and one it might add.
      ...["render", "action", "route", "proxy", "something-new"].map((routeType) =>
        serverFault({ route: "/rolls/[id]", routeType, request: "GET /rolls/abc", message, digest: "123" }),
      ),
    ];

    for (const alert of alerts) {
      const text = renderAlert(alert);
      const [what, , meaning, , action] = text.split("\n");

      expect(what).toMatch(/^The (app|site) hit an error /);
      expect(meaning).toMatch(/^What it means: \S/);
      expect(action).toMatch(/^What to do: \S/);

      // What the machine said is there, because a fix starts from it — but never above the label.
      expect(text.split(LABEL)[0]).not.toContain(message);
      expect(text).toContain(`${LABEL}\n${message}`);
    }
  }
});

test("the detail is cut short, and left out entirely when there is none", () => {
  const long = renderAlert({ what: "w", meaning: "m", action: "a", detail: "x".repeat(5_000) });
  expect(long.length).toBeLessThan(1_000);

  expect(renderAlert({ what: "w", meaning: "m", action: "a" })).toBe(
    "w\n\nWhat it means: m\n\nWhat to do: a",
  );
});
