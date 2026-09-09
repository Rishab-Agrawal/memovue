/**
 * Exercises the rules that attach anonymous guest sessions to an account at sign-in.
 *
 * This one path cannot be covered by the Playwright suite: it runs inside the Google OAuth
 * callback, and a browser cannot complete a real round trip unattended. Its guards are the
 * kind worth being sure about — one of them is all that stops a sign-in claiming somebody
 * else's identity inside a roll — so they are checked here against the real database with the
 * real function, rather than left to reasoning.
 *
 * `--conditions=react-server` makes the `server-only` guard resolve to its empty stub, the
 * same way it does inside a Next server build.
 *
 *   npx tsx --conditions=react-server scripts/verify-guest-link.ts
 */
import "./load-env";

import { checkEqual as check, verdict } from "./checks";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TAG = "guest-link-check";

async function main() {
  // Imported here rather than at the top: `src/lib/prisma` reads DATABASE_URL the moment it
  // loads, and a static import would hoist above the variables it needs.
  const { linkGuestSessions } = await import("../src/lib/guest-link");
  const { signGuestToken } = await import("../src/lib/auth");

  // Two accounts and a roll to hang everything off.
  const [owner, other] = await Promise.all([
    prisma.user.upsert({
      where: { email: `${TAG}-owner@memovue.test` },
      create: { email: `${TAG}-owner@memovue.test`, name: "Link Owner" },
      update: {},
    }),
    prisma.user.upsert({
      where: { email: `${TAG}-other@memovue.test` },
      create: { email: `${TAG}-other@memovue.test`, name: "Link Other" },
      update: {},
    }),
  ]);

  const now = new Date();
  const makeRoll = (code: string) =>
    prisma.roll.create({
      data: {
        code,
        hostId: other.id,
        name: TAG,
        maxGuests: 50,
        photosPerGuest: 24,
        startsAt: now,
        finishesAt: new Date(now.getTime() + 86_400_000),
        revealAt: new Date(now.getTime() + 86_400_000),
        keptUntil: new Date(now.getTime() + 30 * 86_400_000),
      },
    });

  const [rollA, rollB, rollC, rollD] = await Promise.all([
    makeRoll("ZZLKA1"),
    makeRoll("ZZLKB2"),
    makeRoll("ZZLKC3"),
    makeRoll("ZZLKD4"),
  ]);

  const guest = (rollId: string, name: string, userId?: string) =>
    prisma.guest.create({ data: { rollId, name, userId: userId ?? null } });

  const token = (g: { id: string; rollId: string }) =>
    signGuestToken({ id: g.id, eventId: g.rollId });

  console.log("\nthe plain case");
  const plain = await guest(rollA.id, "Anon A");
  check("one anonymous session is linked", await linkGuestSessions(owner.id, [await token(plain)]), 1);
  check(
    "and the row now carries the account",
    (await prisma.guest.findUnique({ where: { id: plain.id } }))?.userId,
    owner.id,
  );

  console.log("\nsomebody else's identity is never taken");
  const theirs = await guest(rollB.id, "Anon B", other.id);
  check("a row already on an account is left alone", await linkGuestSessions(owner.id, [await token(theirs)]), 0);
  check(
    "still theirs",
    (await prisma.guest.findUnique({ where: { id: theirs.id } }))?.userId,
    other.id,
  );

  console.log("\na cookie has to name the roll its row is in");
  const elsewhere = await guest(rollC.id, "Anon C");
  const crossed = await signGuestToken({ id: elsewhere.id, eventId: rollB.id });
  check("a token naming another roll is ignored", await linkGuestSessions(owner.id, [crossed]), 0);
  check(
    "the row stays anonymous",
    (await prisma.guest.findUnique({ where: { id: elsewhere.id } }))?.userId,
    null,
  );

  console.log("\none identity per roll survives a browser with two cookies");
  const first = await guest(rollD.id, "Anon D1");
  const second = await guest(rollD.id, "Anon D2");
  check(
    "only one of the two is taken",
    await linkGuestSessions(owner.id, [await token(first), await token(second)]),
    1,
  );
  check(
    "and the roll holds exactly one row for the account",
    await prisma.guest.count({ where: { rollId: rollD.id, userId: owner.id } }),
    1,
  );

  console.log("\nan account already in the roll is not joined twice");
  const mine = await guest(rollA.id, "Owner already", undefined);
  await prisma.guest.updateMany({ where: { id: mine.id }, data: { name: "Owner already" } });
  // `plain` above already linked rollA to the owner, so this second cookie has nowhere to go.
  check("the second cookie for that roll is declined", await linkGuestSessions(owner.id, [await token(mine)]), 0);

  console.log("\nnonsense in, nothing out");
  check("garbage tokens", await linkGuestSessions(owner.id, ["not-a-token", ""]), 0);
  check("no tokens at all", await linkGuestSessions(owner.id, []), 0);

  // Tidy up.
  await prisma.roll.deleteMany({ where: { name: TAG } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@memovue.test" }, name: { startsWith: "Link " } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    verdict();
    await prisma.$disconnect();
  });
