/**
 * Sets the R2 bucket's CORS (browsers PUT photos straight to it), then checks the Cloudflare
 * zone's cache and rate-limit rules. Re-run after adding a domain.
 *
 *   npx tsx scripts/setup-r2.ts           # CORS, then the rule check
 *   npx tsx scripts/setup-r2.ts --rules   # the rule check only
 *
 * The rules are only read, never written: they are dashboard settings, and a script pushing
 * them would eventually overwrite a deliberate change.
 */
import "./load-env";

import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error("R2 environment variables are not set — see .env.example");
}

const origins = [
  "http://localhost:3000",
  "https://memovue.com",
  "https://www.memovue.com",
  ...(process.env.APP_URL && !process.env.APP_URL.includes("localhost")
    ? [process.env.APP_URL.replace(/\/$/, "")]
    : []),
  ...(process.env.EXTRA_CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
];

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

/* ------------------------------------------------------------------ the zone's two rules */

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

/** Catches a TTL cleared or reset to Cloudflare's default; the live values are printed anyway. */
const MIN_TTL_SECONDS = 86_400;

interface Rule {
  enabled?: boolean;
  expression?: string;
  action_parameters?: {
    edge_ttl?: { mode?: string; default?: number };
    browser_ttl?: { mode?: string; default?: number };
  };
}

async function cloudflare<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${CLOUDFLARE_API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json()) as {
    success?: boolean;
    result?: T;
    errors?: { message: string }[];
  };
  // A permitted-but-refused token answers 200 with `success: false`, which is not an empty ruleset.
  if (!body.success) {
    throw new Error(body.errors?.map((e) => e.message).join("; ") || `HTTP ${response.status}`);
  }
  return body.result as T;
}

/**
 * The rules in one phase of a zone, or why they could not be read. Per phase, because each needs
 * its own token permission. Unreadable and empty are different answers and stay distinct.
 */
async function rulesFor(
  token: string,
  zoneId: string,
  phase: string,
): Promise<Rule[] | { unreadable: string }> {
  try {
    const ruleset = await cloudflare<{ rules?: Rule[] }>(
      token,
      `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`,
    );
    return ruleset.rules ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A never-configured phase has no entrypoint ruleset, reported as "could not find": that means empty, not unreadable.
    if (/404|could not (be )?found?|could not find/i.test(message)) return [];
    return { unreadable: message };
  }
}

/**
 * That the CDN's cache rule and rate limit still exist with long TTLs — zone config that keeps
 * image reads off the R2 bill and that nothing in the repo would otherwise notice disappearing.
 * Unreadable is a warning (a fresh clone has no token); a missing rule exits non-zero.
 */
async function checkZoneRules(): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!token || !publicUrl) {
    console.warn(
      "\nUNCHECKED: cache and rate-limit rules."
        + `\n  ${!publicUrl ? "R2_PUBLIC_URL is not set" : "CLOUDFLARE_API_TOKEN is not set"}.`
        + "\n  The token needs Zone > Zone: Read and Zone > Cache Rules: Read.",
    );
    return;
  }

  const host = new URL(publicUrl).hostname;
  // ponytail: the zone is the last two labels of the CDN host, which is right for
  // memovue.com and wrong for anything under a multi-part suffix like .co.uk. Read the zone
  // id from an env var if that ever stops being true.
  const zoneName = host.split(".").slice(-2).join(".");

  const scopes = "Zone: Read, Cache Rules: Read and Zone WAF: Read";

  let zoneId: string;
  try {
    const zones = await cloudflare<{ id: string }[]>(token, `/zones?name=${zoneName}`);
    if (!zones.length) {
      console.warn(
        `\nUNCHECKED: no zone named "${zoneName}" is visible to this token.`
          + `\n  It needs ${scopes}, on all zones or on that one.`,
      );
      return;
    }
    zoneId = zones[0].id;
  } catch (error) {
    console.warn(
      `\nUNCHECKED: could not look up the zone "${zoneName}"`
        + ` — ${error instanceof Error ? error.message : String(error)}`
        + `\n  The token needs ${scopes}.`,
    );
    return;
  }

  const [cacheRules, rateLimits] = await Promise.all([
    rulesFor(token, zoneId, "http_request_cache_settings"),
    rulesFor(token, zoneId, "http_ratelimit"),
  ]);

  const problems: string[] = [];
  const warnings: string[] = [];
  const forCdn = (rules: Rule[]) =>
    rules.filter((rule) => rule.enabled !== false && rule.expression?.includes(host));

  console.log(`\nZone "${zoneName}" rules covering ${host}:`);

  // Edge TTL keeps repeat reads off R2; browser TTL keeps them off the network. Set as a rule
  // rather than object headers, so it also covers everything already uploaded.
  const cache = "unreadable" in cacheRules ? [] : forCdn(cacheRules);
  if ("unreadable" in cacheRules) {
    console.log(`  cache rule   UNREADABLE — ${cacheRules.unreadable}`);
    warnings.push(`Cache rules could not be read — the token needs Zone > Cache Rules: Read.`);
  }
  const ttl = (kind: "edge_ttl" | "browser_ttl") => {
    const best = cache
      .map((rule) => rule.action_parameters?.[kind])
      .filter((set) => set?.mode === "override_origin" && typeof set.default === "number")
      .sort((a, b) => (b!.default ?? 0) - (a!.default ?? 0))[0];
    return best?.default ?? null;
  };

  const days = (seconds: number) => `${(seconds / 86_400).toFixed(1)}d`;
  for (const kind of "unreadable" in cacheRules ? [] : (["edge_ttl", "browser_ttl"] as const)) {
    const seconds = ttl(kind);
    const label = kind === "edge_ttl" ? "edge TTL   " : "browser TTL";
    if (seconds === null) {
      console.log(`  ${label}  NOT OVERRIDDEN`);
      problems.push(
        `${kind === "edge_ttl" ? "Edge" : "Browser"} TTL is not overridden on any cache rule`
          + ` — objects carry no Cache-Control, so this falls back to Cloudflare's default.`,
      );
    } else {
      console.log(`  ${label}  ${days(seconds)} (${seconds}s)`);
      if (seconds < MIN_TTL_SECONDS) {
        problems.push(`${kind} is only ${seconds}s — under the ${MIN_TTL_SECONDS}s floor.`);
      }
    }
  }

  if ("unreadable" in rateLimits) {
    console.log(`  rate limit   UNREADABLE — ${rateLimits.unreadable}`);
    warnings.push("Rate limiting could not be read — the token needs Zone > Zone WAF: Read.");
  } else {
    const limits = forCdn(rateLimits);
    console.log(`  rate limit   ${limits.length ? `${limits.length} rule(s)` : "NONE"}`);
    // A warning, not a failure: rate limiting is a paid add-on we have chosen not to buy.
    if (!limits.length) {
      warnings.push(
        `No rate-limiting rule matches ${host} — it is a paid add-on. What bounds a flood`
          + " instead: keys are unguessable, so a stranger can only ask for URLs they were"
          + " given, and those are edge hits that never reach R2.",
      );
    }
  }

  if (warnings.length) {
    // Holds both unreadable and deliberately absent; each line says which.
    console.warn("\nNOTED:");
    for (const warning of warnings) console.warn(`  ${warning}`);
  }

  if (problems.length) {
    console.error("\nRULES NEED ATTENTION:");
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      `\n  Set them at: https://dash.cloudflare.com → ${zoneName} → Caching > Cache Rules`
        + " and Security > WAF > Rate limiting rules.",
    );
    process.exitCode = 1;
  }
}

async function main() {
  // Read-only half on its own, for checking the zone without touching the bucket's CORS.
  if (process.argv.includes("--rules")) return checkZoneRules();

  const allowed = [...new Set(origins)];

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowed,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["content-type"],
            ExposeHeaders: ["etag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  // Read back rather than trusted: the account-scoped token this needs may not exist next time.
  const live = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  const liveOrigins = live.CORSRules?.[0]?.AllowedOrigins ?? [];

  console.log(`CORS live on bucket "${bucket}":`);
  for (const origin of liveOrigins) console.log(`  ${origin}`);

  const missing = allowed.filter((origin) => !liveOrigins.includes(origin));
  if (missing.length) {
    console.error(`\nMISSING after write: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`\nAll ${allowed.length} expected origins confirmed.`);

  await checkZoneRules();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
