/**
 * Sends one real email through Resend using the same From address the app uses.
 *
 * Worth having as a script because the app swallows send failures on purpose — a broken
 * notification must never break the action that triggered it — so a misconfigured sender
 * would otherwise fail silently and only show up as hosts never hearing back.
 *
 *   RESEND_API_KEY=... npx tsx scripts/verify-email.ts [recipient]
 */
import { config as loadEnv } from "dotenv";
import { Resend } from "resend";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "MemoVue <hello@memovue.com>";
// Defaults to the support address, which round-trips through Cloudflare Email Routing and
// therefore checks sending and receiving in one go.
const to = process.argv[2] ?? "hello@memovue.com";

if (!apiKey) throw new Error("RESEND_API_KEY is not set");

async function main() {
  console.log(`from  ${from}`);
  console.log(`to    ${to}`);

  const { data, error } = await new Resend(apiKey).emails.send({
    from,
    to,
    subject: "MemoVue email check",
    text:
      "If you are reading this, sending through Resend and receiving through " +
      "Cloudflare Email Routing both work.\n\n— MemoVue",
  });

  if (error) {
    console.error(`\nFAILED: ${error.name} — ${error.message}`);
    process.exit(1);
  }
  console.log(`\nAccepted by Resend. id=${data?.id}`);
}

main().catch((error) => {
  console.error(`\nFAILED: ${(error as Error).message}`);
  process.exit(1);
});
