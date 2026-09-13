/**
 * Proves each kind of owner notification lands in the group, in its topic. A misrouted send
 * (wrong chat, deleted topic, bot removed) still answers `ok`, so this posts one real message
 * per topic and reads back where it landed. Run after changing any `TELEGRAM_*` variable.
 *
 *   npm run verify:telegram
 */
import "./load-env";

import { check, verdict } from "./checks";

async function main() {
  // Imported after `load-env`. It throws locally on a bad chat id, which is reported, not crashed on.
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

    // The reply says where it really landed.
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
