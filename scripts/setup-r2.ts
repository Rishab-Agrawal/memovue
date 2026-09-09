/**
 * Applies the bucket-level configuration MemoVue needs on R2, then reads back the two
 * Cloudflare rules that keep reads off the bill.
 *
 * Browsers PUT photo bytes straight at R2, so the bucket must allow cross-origin PUTs
 * from wherever the app is served. Re-run this after adding a new domain.
 *
 *   npx tsx scripts/setup-r2.ts
 *
 * The rules are only ever *read* here, never written. They live on a zone, they are somebody's
 * considered choice about numbers, and — like Railway's spend limits in the cost watch — a
 * script that pushed them from a repo would eventually overwrite a change made on purpose.
 * What this asserts is that they exist and that their TTLs are long, which is the property
 * the bill depends on and the one nothing else would ever notice going missing.
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

/**
 * Below this, a rule is not doing the job it exists for.
 *
 * A day is deliberately far under what should be set — the point is to catch a TTL that has
 * been cleared or dropped to Cloudflare's two-hour default, not to insist on a number. The
 * live values are printed either way, which is what a human actually reads.
 */
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
  // Cloudflare answers 200 with `success: false` for a token that is alive but not permitted,
  // so the status line alone would read a refusal as an empty ruleset — which is exactly the
  // shape of the failure this is here to catch.
  if (!body.success) {
    throw new Error(body.errors?.map((e) => e.message).join("; ") || `HTTP ${response.status}`);
  }
  return body.result as T;
}

/**
 * The rules in one phase of a zone, or why they could not be read.
 *
 * Per phase rather than for both at once, because the two need different permissions on the
 * token — cache rules and the WAF are separate grants — and a token holding one of them
 * should report what it can see instead of going blind on everything. Reading nothing is a
 * warning; reading an empty phase is a finding, and they must not collapse into each other.
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
    /*
      A phase nothing has ever been configured in has no entrypoint ruleset to return, and
      Cloudflare says so in prose — "could not find entrypoint ruleset in the http_ratelimit
      phase" — rather than with an empty list. That is the finding, not a failure to look, and
      reading it as one is how "you have no rate limiting at all" first got reported here as
      "your token cannot see the rate limiting". A refusal reads nothing like this: it names
      the actor and the permission it wants.
    */
    if (/404|could not (be )?found?|could not find/i.test(message)) return [];
    return { unreadable: message };
  }
}

/**
 * That the cache rule and the rate limit are both still there, and still long.
 *
 * These two are the only things standing between a public image domain and an unbounded R2
 * bill, and neither lives in this repo — they are zone configuration, enforced at the edge
 * whether or not anything of ours is running, which is exactly why they are worth having and
 * exactly why nothing here would notice one being deleted. The cost watch would eventually:
 * a cache rule that has gone means every read reaching R2, which shows up as money four hours
 * later. This says so before the month does.
 *
 * Unreadable is a warning and missing is an error, deliberately. Not being able to look —
 * no token, or a token without `Zone > Cache Rules > Read` — is an absence of evidence, and
 * failing the whole setup over it would make a fresh clone look broken. A rule that is
 * genuinely not there is evidence of absence, and it exits non-zero.
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

  /*
    Edge TTL is what keeps a photograph out of R2 after the first person in a region opens the
    album; browser TTL is what keeps it off the network at all on the second look. Both are
    set here rather than as a `Cache-Control` header on the objects, because a header can only
    ever apply to what is uploaded after it ships — every photograph already in the bucket
    would keep whatever it was stored with, and the rule covers those too.
  */
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
    /*
      A warning and not a failure, because rate limiting is a paid add-on on this account and
      not having it is a decision rather than a regression — see "Known and left alone" in the
      README for what covers the gap. A check that fails every run for a reason nobody intends
      to fix is a check that gets muted, and it would take the cache rule down with it.
    */
    if (!limits.length) {
      warnings.push(
        `No rate-limiting rule matches ${host} — it is a paid add-on. What bounds a flood`
          + " instead: keys are unguessable, so a stranger can only ask for URLs they were"
          + " given, and those are edge hits that never reach R2.",
      );
    }
  }

  if (warnings.length) {
    // Not "UNCHECKED": this list holds both what could not be read and what is deliberately
    // absent, and the lines say which. A heading that called the second one unchecked would
    // be the same kind of untrue claim this whole check exists to catch.
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

  // Read it back rather than trusting the write, because this is the one piece of config
  // that needs an account-scoped token — once that token is gone it can't be corrected.
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
