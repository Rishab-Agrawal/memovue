import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Every mutation of a roll is scoped to its host, and this is what says so out loud.
 *
 * Authorization here is a convention rather than a mechanism: `rolls.ts` exports a dozen
 * functions that change somebody's roll, each takes a `hostId`, and each is trusted to put it
 * in the `where` clause. Today all of them do. Nothing stops the next one from taking the
 * parameter, never using it, and typechecking perfectly — which is an IDOR that reads like
 * ordinary code in review, since the signature looks exactly right.
 *
 * A Prisma extension refusing unscoped writes was the other option and is the wrong one: the
 * retention sweep deletes rolls by id alone, legitimately and nightly, so a runtime guard
 * would need an escape hatch and the escape hatch would become the habit. Reading the source
 * costs nothing, runs with the unit suite, and fails at the moment the mistake is written.
 */
const SOURCE = readFileSync("src/lib/rolls.ts", "utf8");

/** Function name → its parameter list and body, for everything the module declares. */
function declarations(source: string): { name: string; params: string; body: string }[] {
  const out: { name: string; params: string; body: string }[] = [];
  const re = /^(?:export )?(?:async )?function (\w+)\(([\s\S]*?)\)[^{]*\{/gm;

  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const from = match.index + match[0].length;
    // Up to the next top-level declaration, which is close enough: nothing here nests
    // another `function` at column zero.
    const next = source.slice(from).search(/^(?:export )?(?:async )?(?:function|const) /m);
    out.push({
      name: match[1],
      params: match[2],
      body: next === -1 ? source.slice(from) : source.slice(from, from + next),
    });
  }
  return out;
}

test("every roll function given a hostId actually scopes on it", () => {
  const scoped = declarations(SOURCE).filter((fn) => /\bhostId\b/.test(fn.params));

  // If this drops to zero the parser has broken, not the code.
  expect(scoped.length).toBeGreaterThan(8);

  const unscoped = scoped.filter((fn) => !/\bhostId\b/.test(fn.body)).map((fn) => fn.name);
  expect(unscoped, `these take a hostId and never use it: ${unscoped.join(", ")}`).toEqual([]);
});

test("nothing outside rolls.ts and the sweep writes to a roll", () => {
  // `retention.ts` owns the unscoped deletes — that is the nightly purge, and it is reached
  // only from a cron service and from `deleteRoll`, which has already checked the host.
  const writes = /prisma\.roll\.(update|updateMany|delete|deleteMany|create|upsert)\b/;

  const offenders = ["src/app/rolls/[id]/loadRoll.ts", "src/app/e/[code]/page.tsx"].filter(
    (file) => writes.test(readFileSync(file, "utf8")),
  );

  expect(offenders, "screens must go through rolls.ts, which scopes on the host").toEqual([]);
});
