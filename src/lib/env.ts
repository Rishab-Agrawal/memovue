// A build error, not a runtime crash, if a client component imports this: it reads secrets.
import "server-only";

/** Server-side runtime configuration. Browser-safe values live in `constants.ts`. */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2Bucket = process.env.R2_BUCKET;
const r2PublicUrl = process.env.R2_PUBLIC_URL;

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

/** Injected into every deployed Railway service, web and cron alike, and nowhere else. */
const isDeployed = Boolean(process.env.RAILWAY_ENVIRONMENT);

/**
 * The notification group, or nothing if what is configured is not a group.
 *
 * A positive id is a private chat with the bot: it delivers, but has no forum topics, so every
 * channel collapses into one stream. Refused locally, where it is pasted in; on a deployment it
 * only switches notifications off, so a config typo cannot take the site or a cron job down.
 */
function telegramGroupChatId(): string | undefined {
  const id = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!id || id.startsWith("-")) return id || undefined;

  const complaint =
    `TELEGRAM_CHAT_ID is ${id}, which is a private chat with the bot rather than the ` +
    "notification group. A group's id is negative, and a supergroup with topics starts -100.";
  if (isDeployed) {
    console.error(`${complaint} Telegram notifications are off until it names the group.`);
    return undefined;
  }
  throw new Error(complaint);
}

const telegramChatId = telegramGroupChatId();

const railwayApiToken = process.env.RAILWAY_API_TOKEN;
const railwayWorkspaceId = process.env.RAILWAY_WORKSPACE_ID;
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;

/** A forum topic id, or undefined for the group's General thread. */
function topicId(name: string): number | undefined {
  const id = Number(process.env[name]);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export const env = {
  appUrl,

  // Dev gets a stable throwaway secret so sessions survive a server restart.
  authSecret: required(
    "AUTH_SECRET",
    process.env.NODE_ENV === "production" ? undefined : "memovue-dev-secret-not-for-production",
  ),

  /** Email that is auto-promoted to ADMIN on signup, so the owner never touches the DB. */
  adminEmail: (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim(),

  // All five or nothing: a bucket without its CDN domain must not boot half-configured.
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
   * Google sign-in, nullable so a fresh clone boots without credentials. The redirect URI must
   * match the one registered in Google Cloud Console, so changing APP_URL means updating it there.
   */
  google:
    googleClientId && googleClientSecret
      ? {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          redirectUri: `${appUrl}/api/auth/google/callback`,
        }
      : null,

  resendApiKey: process.env.RESEND_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || "MemoVue <hello@memovue.com>",

  /** Owner notifications. Both token and chat id, or neither. */
  telegram:
    telegramBotToken && telegramChatId
      ? {
          token: telegramBotToken,
          chatId: telegramChatId,
          topics: {
            alerts: topicId("TELEGRAM_TOPIC_ALERTS"),
            signals: topicId("TELEGRAM_TOPIC_SIGNALS"),
            daily: topicId("TELEGRAM_TOPIC_DAILY"),
            query: topicId("TELEGRAM_TOPIC_QUERY"),
          },
          /** What Telegram signs its webhook calls with. Unset, `/api/telegram` answers nothing. */
          webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || null,
        }
      : null,

  /**
   * Read-only credentials for the two bills. See `cost.ts`. Independent, so losing one does not
   * blind the other; a missing one makes the cost watch say so rather than go quiet.
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

  /**
   * A deployed service rather than a laptop. NODE_ENV cannot tell: `next start` says production
   * locally and cron services have none. `telegram.ts` uses it so dev machines, which share the
   * live bot config, do not post into the live group.
   */
  isDeployed,

  /** The bucket prefix. See `storage.ts`. */
  r2Prefix: process.env.R2_PREFIX?.trim() || (process.env.NODE_ENV === "production" ? "events" : "dev"),
} as const;
