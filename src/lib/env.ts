// Importing this from a client component is a build error rather than a runtime crash:
// it reads secrets at module scope, and a browser bundle would both fail and leak.
import "server-only";

/**
 * Server-side runtime configuration.
 *
 * Values shared with the browser (image dimensions, quality targets) live in
 * `constants.ts` instead, precisely so they can be imported without dragging secrets along.
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2Bucket = process.env.R2_BUCKET;
const r2PublicUrl = process.env.R2_PUBLIC_URL;

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

/**
 * The notification group, or nothing if what is configured is not a group.
 *
 * Telegram numbers a group negatively and a person positively, and `getUpdates` hands you your
 * own id first if you ever opened the bot before making the group. So the documented way to
 * read this value is also the way to aim every alert, signal and digest at a private chat with
 * the bot — which delivers, quietly, and looks exactly like working.
 *
 * That is not a cosmetic difference. A private chat has no forum topics, so `message_thread_id`
 * is ignored there and three channels read at three different speeds collapse into one stream
 * nobody can triage. Every other misconfiguration here degrades toward "delivered, just less
 * sorted"; this one degrades toward "delivered somewhere nobody asked for", which is the one
 * direction a notification channel must not fall.
 *
 * Off a deployment this throws, because the only moment this value is ever wrong is the moment
 * somebody pastes it in, and that is the moment worth refusing to start. On one it only
 * switches the channel off and says so: a notification setting must not be able to take the
 * site down mid-party, and — the reason this is not keyed on NODE_ENV — the four cron services
 * run plain `tsx` with no NODE_ENV at all, so that test would have let a mistyped chat id stop
 * the nightly backup. `RAILWAY_ENVIRONMENT` is injected into every deployed service, web and
 * cron alike, and exists nowhere else.
 */
export function telegramGroupChatId(): string | undefined {
  const id = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!id || id.startsWith("-")) return id || undefined;

  const complaint =
    `TELEGRAM_CHAT_ID is ${id}, which is a private chat with the bot rather than the ` +
    "notification group. A group's id is negative, and a supergroup with topics starts -100.";
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.error(`${complaint} Telegram notifications are off until it names the group.`);
    return undefined;
  }
  throw new Error(complaint);
}

const telegramChatId = telegramGroupChatId();

const railwayApiToken = process.env.RAILWAY_API_TOKEN;
const railwayWorkspaceId = process.env.RAILWAY_WORKSPACE_ID;
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;

/**
 * A forum topic in the notification group, or undefined for the group's General thread.
 *
 * Individually optional, unlike the token and the chat id: a group works perfectly well
 * without topics turned on, and a message with no thread id lands in General rather than
 * failing. So an unset one degrades to "still delivered, just less sorted", which is the only
 * safe direction for an alarm channel to fall.
 */
function topicId(name: string): number | undefined {
  const id = Number(process.env[name]);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),

  // Dev gets a stable throwaway secret so sessions survive a server restart.
  authSecret: required(
    "AUTH_SECRET",
    process.env.NODE_ENV === "production" ? undefined : "memovue-dev-secret-not-for-production",
  ),

  /** Email that is auto-promoted to ADMIN on signup, so the owner never touches the DB. */
  adminEmail: (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim(),

  /*
    All five or nothing, deliberately.

    `R2_PUBLIC_URL` sits in the same conjunction as the credentials rather than optional beside
    them, so a deploy cannot come up half-configured — with a bucket but no cached domain —
    and quietly fall back to minting a signed URL per image. That failure would be silent and
    would cost real money, which is the worst pair of properties a misconfiguration can have.
  */
  r2:
    r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2Bucket && r2PublicUrl
      ? {
          accountId: r2AccountId,
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
          bucket: r2Bucket,
          endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
          /** The Cloudflare custom domain in front of the bucket. No trailing slash. */
          publicUrl: r2PublicUrl.replace(/\/$/, ""),
        }
      : null,

  /**
   * Google sign-in. Nullable like `r2` so a fresh clone still boots without credentials —
   * the sign-in route reports it as unconfigured rather than the whole app failing to start.
   *
   * The redirect URI is derived from `appUrl` and must match the one registered on the
   * OAuth client character for character, so changing APP_URL means adding the new URI in
   * Google Cloud Console too.
   */
  google:
    googleClientId && googleClientSecret
      ? {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          redirectUri: `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/auth/google/callback`,
        }
      : null,

  resendApiKey: process.env.RESEND_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || "MemoVue <hello@memovue.com>",

  /**
   * Where everything the owner needs to know is pushed. Both or neither: a token with nowhere
   * to send and a chat id with nothing to send it are each a config that looks present and
   * notifies nobody.
   */
  telegram:
    telegramBotToken && telegramChatId
      ? {
          token: telegramBotToken,
          chatId: telegramChatId,
          topics: {
            alerts: topicId("TELEGRAM_TOPIC_ALERTS"),
            signals: topicId("TELEGRAM_TOPIC_SIGNALS"),
            daily: topicId("TELEGRAM_TOPIC_DAILY"),
          },
        }
      : null,

  /**
   * Read-only credentials for the two meters that bill us. See `cost.ts`.
   *
   * Independent of each other rather than one group, because they are two separate bills and
   * losing sight of the small one must not cost us sight of the large one. Cloudflare reuses
   * the R2 account id already configured above — it is the same account, and a second copy of
   * it is a second thing to get wrong.
   *
   * Both are optional and neither is a secret this app spends: a missing one degrades to the
   * cost watch saying so, out loud, every four hours. It is deliberately not possible for
   * this to fail quietly, because a cost alarm that has gone blind looks exactly like a cheap
   * month.
   */
  cost: {
    railway:
      railwayApiToken && railwayWorkspaceId
        ? { token: railwayApiToken, workspaceId: railwayWorkspaceId }
        : null,
    cloudflare:
      cloudflareApiToken && r2AccountId
        ? { token: cloudflareApiToken, accountId: r2AccountId }
        : null,
  },

  isProduction: process.env.NODE_ENV === "production",
} as const;

export { UPLOAD_LIMITS } from "./constants";
