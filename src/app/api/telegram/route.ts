import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { chunk, describeDeleted, describeHosts, describeRoll, rollReportSelect } from "@/lib/roll-report";
import { notify } from "@/lib/telegram";

/**
 * The query topic, answered.
 *
 *   /rolls                    every host, with how many rolls they have and their latest one
 *   /rolls all                everyone who has signed in, rolls or not
 *   /rolls someone@gmail.com  each of that host's rolls, deleted ones included, newest first
 *
 * Telegram posts every message the bot can see here (see `setWebhook` in `.env.example`),
 * signed with TELEGRAM_WEBHOOK_SECRET. Another chat, another topic or another command gets a
 * 200 and nothing else, because anything but a 200 makes Telegram deliver it again.
 */
export async function POST(request: Request) {
  const telegram = env.telegram;
  if (
    !telegram?.webhookSecret ||
    request.headers.get("x-telegram-bot-api-secret-token") !== telegram.webhookSecret
  ) {
    return new Response(null, { status: 401 });
  }

  const { message } = await request.json();
  const [command, arg] = String(message?.text ?? "").trim().split(/\s+/);
  if (
    String(message?.chat?.id) !== telegram.chatId ||
    message.message_thread_id !== telegram.topics.query ||
    // `/rolls@memovue_bot` is what Telegram's command menu inserts in a group.
    command.split("@")[0] !== "/rolls"
  ) {
    return new Response(null);
  }

  for (const text of await answer(arg?.toLowerCase())) {
    for (const part of chunk(text)) await notify("query", part);
  }
  return new Response(null);
}

/** The day `DeletedRoll` started being written. Nothing deleted before it left a trace. */
const TRACKED_SINCE = "11 Sep 2026";

async function answer(arg: string | undefined): Promise<string[]> {
  if (!arg || arg === "all") {
    const users = await prisma.user.findMany({
      // A row can exist before its first sign-in (the admin, fixtures); `googleId` is the sign-in.
      where: arg
        ? { googleId: { not: null } }
        : { OR: [{ rolls: { some: {} } }, { deletedRolls: { some: {} } }] },
      select: {
        email: true,
        _count: { select: { rolls: true } },
        rolls: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        deletedRolls: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (users.length === 0) return [arg ? "Nobody has signed in yet." : "Nobody has made a roll yet."];

    const hosts = users.map((user) => ({
      email: user.email,
      rolls: user._count.rolls,
      latest: [...user.rolls, ...user.deletedRolls].reduce<Date | null>(
        (latest, roll) => (latest && latest > roll.createdAt ? latest : roll.createdAt),
        null,
      ),
    }));
    return [
      [
        describeHosts(hosts),
        "",
        "Number: rolls that still exist. Brackets: the latest roll created, deleted ones included.",
        `Deletions before ${TRACKED_SINCE} left no trace, so "new" can hide them.`,
      ].join("\n"),
    ];
  }

  const host = await prisma.user.findUnique({
    where: { email: arg },
    select: {
      rolls: { select: rollReportSelect },
      deletedRolls: { select: { createdAt: true, deletedAt: true, deletedBy: true, summary: true } },
    },
  });
  if (!host) return [`${arg} has never signed in.`];

  const now = new Date();
  const rolls = [
    ...host.rolls.map((roll) => ({ createdAt: roll.createdAt, text: describeRoll(roll, now) })),
    ...host.deletedRolls.map((roll) => ({ createdAt: roll.createdAt, text: describeDeleted(roll) })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (rolls.length === 0) return [`${arg} has no rolls, and has deleted none since ${TRACKED_SINCE}.`];

  return rolls.map((roll) => roll.text);
}
