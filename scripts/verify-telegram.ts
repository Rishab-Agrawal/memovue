/**
 * Proves that everything the owner is told actually lands in the group, in the right topic.
 *
 * The failure this exists for delivers perfectly. `TELEGRAM_CHAT_ID` read out of `getUpdates`
 * is whoever spoke to the bot most recently, and the bot is always spoken to before the group
 * exists — so the documented way to fill it in hands you your own user id, and every alert,
 * signal and digest arrives in a direct message with the bot instead. Telegram answers `ok`,
 * nothing is logged, and the only symptom is that the three topics are empty and one private
 * chat has everything in it, unsorted, because a private chat ignores `message_thread_id`.
 *
 * So the check has to be a real send. A shape test on the id would have caught the id, but not
 * a topic deleted in Telegram, a bot demoted out of the group, or a thread number copied from
 * the wrong topic — and each of those fails the same silent way.
 *
 * Four messages are posted, one per topic, and each reply is read back for the thread it
 * actually landed in. Run it after touching any `TELEGRAM_*` variable, in whichever
 * environment you touched.
 *
 *   npm run verify:telegram
 */
import "./load-env";

import { check, verdict } from "./checks";

async function main() {
  // Imported here rather than at the top, because `env.ts` reads the variables the moment it
  // loads and a static import would hoist above it. It also throws outside production on
  // exactly the misconfiguration this script is about, which is a report, not a stack trace.
  const env = await import("../src/lib/env")
    .then((module) => module.env)
    .catch((error: unknown) => {
      check(error instanceof Error ? error.message : String(error), false);
      return null;
    });

  if (!env) return;
  if (!env.telegram) {
    // Either both were left blank, or the chat id was refused above and said why.
    check("there is a channel to send to", false, "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing or was rejected");
    return;
  }

  const api = (method: string, body?: unknown) =>
    fetch(`https://api.telegram.org/bot${env.telegram!.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? { chat_id: env.telegram!.chatId }),
      signal: AbortSignal.timeout(10_000),
    }).then((response) => response.json() as Promise<{ ok: boolean; result?: never; description?: string }>);

  console.log("the chat everything is sent to");
  const chat = (await api("getChat")) as {
    ok: boolean;
    description?: string;
    result?: { type: string; title?: string; is_forum?: boolean };
  };
  check("the bot can see it", chat.ok, chat.description);
  if (!chat.ok) return;

  check(`it is a group, not a private chat (${chat.result?.type})`, chat.result?.type === "supergroup", chat.result?.type);
  check(`topics are turned on in ${chat.result?.title ?? "it"}`, chat.result?.is_forum === true);

  console.log("\nwhere each kind of message lands");
  const stamp = new Date().toISOString().slice(11, 19);
  for (const topic of ["alerts", "signals", "daily", "query"] as const) {
    const thread = env.telegram.topics[topic];
    if (thread === undefined) {
      check(`${topic} has a topic id`, false, `TELEGRAM_TOPIC_${topic.toUpperCase()} is unset, so it would land in General`);
      continue;
    }

    const sent = (await api("sendMessage", {
      chat_id: env.telegram.chatId,
      message_thread_id: thread,
      text: `Channel check ${stamp} — this is the ${topic} topic.`,
      disable_notification: true,
    })) as {
      ok: boolean;
      description?: string;
      result?: { message_thread_id?: number; chat?: { id: number } };
    };

    check(`${topic} accepted the message`, sent.ok, sent.description);
    if (!sent.ok) continue;

    // The reply is the only proof: a wrong chat still answers ok, and a thread id that names
    // a deleted topic comes back attached to whatever Telegram put it in instead.
    check(
      `${topic} landed in thread ${thread}`,
      sent.result?.message_thread_id === thread,
      `landed in ${sent.result?.message_thread_id ?? "General"}`,
    );
    check(
      `${topic} landed in the group`,
      String(sent.result?.chat?.id) === env.telegram.chatId,
      `landed in ${sent.result?.chat?.id}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    check("the run finished", false);
  })
  .finally(() => verdict("four messages are waiting in the group"));
