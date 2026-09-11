import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { chunk, describeRoll } from "@/lib/roll-report";
import { notify } from "@/lib/telegram";

/**
 * The query topic, answered.
 *
 *   /rolls                    every host with a roll, and how many they have
 *   /rolls someone@gmail.com  each of that host's rolls, one message apiece
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
  const [command, email] = String(message?.text ?? "").trim().split(/\s+/);
  if (
    String(message?.chat?.id) !== telegram.chatId ||
    message.message_thread_id !== telegram.topics.query ||
    // `/rolls@memovue_bot` is what Telegram's command menu inserts in a group.
    command.split("@")[0] !== "/rolls"
  ) {
    return new Response(null);
  }

  for (const text of await answer(email?.toLowerCase())) {
    for (const part of chunk(text)) await notify("query", part);
  }
  return new Response(null);
}

async function answer(email: string | undefined): Promise<string[]> {
  if (!email) {
    const hosts = await prisma.user.findMany({
      where: { rolls: { some: {} } },
      orderBy: { email: "asc" },
      select: { email: true, _count: { select: { rolls: true } } },
    });
    if (hosts.length === 0) return ["Nobody has a roll right now."];
    return [
      [
        ...hosts.map((host) => `${host.email} — ${host._count.rolls}`),
        "",
        // ponytail: rows only. A per-host lifetime count needs a tally keyed on the host.
        "Rolls that still exist. Deleted ones, and ones the sweep took 30 days after they ended, are not counted.",
      ].join("\n"),
    ];
  }

  const rolls = await prisma.roll.findMany({
    where: { host: { email } },
    orderBy: { startsAt: "asc" },
    select: {
      name: true,
      startsAt: true,
      finishesAt: true,
      revealMode: true,
      revealDelayHours: true,
      revealedEarly: true,
      maxGuests: true,
      photosPerGuest: true,
      hostId: true,
      guests: {
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          userId: true,
          _count: { select: { photos: { where: { status: "READY" } } } },
        },
      },
    },
  });
  if (rolls.length === 0) return [`${email} has no rolls.`];

  const now = new Date();
  return rolls.map((roll) => describeRoll(roll, now));
}
