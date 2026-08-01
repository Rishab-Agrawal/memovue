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

export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),

  // Dev gets a stable throwaway secret so sessions survive a server restart.
  authSecret: required(
    "AUTH_SECRET",
    process.env.NODE_ENV === "production" ? undefined : "memovue-dev-secret-not-for-production",
  ),

  /** Email that is auto-promoted to ADMIN on signup, so the owner never touches the DB. */
  adminEmail: (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim(),

  r2:
    r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2Bucket
      ? {
          accountId: r2AccountId,
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
          bucket: r2Bucket,
          endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        }
      : null,

  resendApiKey: process.env.RESEND_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || "MemoVue <hello@memovue.com>",

  isProduction: process.env.NODE_ENV === "production",
} as const;

export { UPLOAD_LIMITS } from "./constants";
