/**
 * What the month is costing. Two meters run: Railway (container, database, egress) and
 * Cloudflare R2 (bytes stored, requests). Everything else is free at our size.
 *
 * **The hard stop is not in this file.** Railway takes the workspace offline itself at the
 * account's hard limit, independent of this code running. Only the watching belongs here.
 * Railway's thresholds are read live from the account, never copied into the repo, so there
 * is one number and nothing to drift.
 *
 * No `env` or `server-only` import: credentials arrive as an argument so the arithmetic can be
 * unit-tested.
 */

/**
 * Alert on R2 by itself. Cloudflare serves the CDN with Railway out of the path, so R2 keeps
 * billing after Railway's hard stop, and R2 has no spend cap or usage alert of its own. A
 * constant because Cloudflare has no setting to read back; set well under Railway's alert so
 * it fires first.
 */
export const R2_ALERT_USD = 2;

/** R2 Standard, from developers.cloudflare.com/r2/pricing, read 2026-09-05. Egress is free. */
const PRICE = { perGbMonth: 0.015, classAPerMillion: 4.5, classBPerMillion: 0.36 };

/** Cloudflare's monthly allowance, granted per account rather than per bucket. */
const FREE = { gb: 10, classA: 1_000_000, classB: 10_000_000 };

/**
 * Which of R2's two request prices an operation is charged at. Unknown operations count as
 * Class A, so a new one pushes the estimate up rather than leaving money out.
 */
export function requestClass(actionType: string): "A" | "B" | "free" {
  if (/^(Delete|Abort)/.test(actionType)) return "free";
  if (/^(Get|Head)/.test(actionType)) return "B";
  return "A";
}

interface R2Usage {
  /** Gigabytes stored across every bucket in the account, at the most recent sample. */
  gb: number;
  /** Writes and listings so far this calendar month, account-wide. */
  classA: number;
  /** Reads so far this calendar month, account-wide. */
  classB: number;
}

/**
 * What R2 charges for a month at this size and request count. Storage is priced as a whole month
 * at today's size, which over-states a growing month — the safe direction for an alarm.
 * Allowances come off the account total, so this takes account-wide figures.
 */
export function r2Bill(usage: R2Usage): number {
  return (
    Math.max(0, usage.gb - FREE.gb) * PRICE.perGbMonth +
    (Math.max(0, usage.classA - FREE.classA) / 1e6) * PRICE.classAPerMillion +
    (Math.max(0, usage.classB - FREE.classB) / 1e6) * PRICE.classBPerMillion
  );
}

/* ------------------------------------------------------------------ reading the meters */

interface Credentials {
  /** An account or workspace token from railway.com/account/tokens, and the workspace it reads. */
  railway: { token: string; workspaceId: string } | null;
  /** A Cloudflare token with Account Analytics:Read, and the account R2 lives in. */
  cloudflare: { token: string; accountId: string } | null;
}

/** A cron has time. Nothing here is behind a spinner somebody is watching. */
const TIMEOUT_MS = 20_000;

const RAILWAY_API = "https://backboard.railway.com/graphql/v2";
const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4/graphql";

async function graphql<T>(
  url: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // Both APIs answer 200 with `errors` for a dead token; reading only the status would turn it into a healthy zero.
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.data) throw new Error("answered with no data");
  return body.data;
}

interface RailwaySpend {
  /** Dollars used this billing cycle, across every project in the workspace. */
  usd: number;
  /** The account's email alert and hard stop, live. Null means none is set. */
  soft: number | null;
  hard: number | null;
}

/**
 * Railway's own figure for this billing cycle — the same meter its hard limit reads. Covers the
 * whole workspace, which is also what the hard limit stops.
 */
async function railwaySpend(
  credentials: NonNullable<Credentials["railway"]>,
): Promise<RailwaySpend> {
  const data = await graphql<{
    workspace: {
      customer: {
        currentUsage: number | null;
        usageLimit: { softLimit: number | null; hardLimit: number | null } | null;
      } | null;
    } | null;
  }>(
    RAILWAY_API,
    credentials.token,
    `query ($workspaceId: String!) {
       workspace(workspaceId: $workspaceId) {
         customer {
           currentUsage
           usageLimit { softLimit hardLimit }
         }
       }
     }`,
    { workspaceId: credentials.workspaceId },
  );

  const customer = data.workspace?.customer;
  if (!customer) throw new Error("no billing customer on this workspace");

  return {
    usd: customer.currentUsage ?? 0,
    soft: customer.usageLimit?.softLimit ?? null,
    hard: customer.usageLimit?.hardLimit ?? null,
  };
}

/**
 * What R2 holds and what has been asked of it this calendar month.
 *
 * The month is UTC, to line up with Cloudflare's invoice. Storage is a level, so it is the
 * latest sample per bucket over a three-day window, not a sum.
 */
async function r2Usage(
  credentials: NonNullable<Credentials["cloudflare"]>,
  now: Date,
): Promise<R2Usage> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const storageFrom = new Date(now.getTime() - 3 * 86_400_000);

  const data = await graphql<{
    viewer: {
      accounts: {
        storage: {
          max: { payloadSize: number; metadataSize: number };
          dimensions: { datetime: string; bucketName: string };
        }[];
        operations: { sum: { requests: number }; dimensions: { actionType: string } }[];
      }[];
    };
  }>(
    CLOUDFLARE_API,
    credentials.token,
    `query ($account: string!, $monthStart: Time!, $storageFrom: Time!, $now: Time!) {
       viewer {
         accounts(filter: { accountTag: $account }) {
           storage: r2StorageAdaptiveGroups(
             limit: 1000
             orderBy: [datetime_DESC]
             filter: { datetime_geq: $storageFrom, datetime_leq: $now }
           ) {
             max { payloadSize metadataSize }
             dimensions { datetime bucketName }
           }
           operations: r2OperationsAdaptiveGroups(
             limit: 1000
             filter: { datetime_geq: $monthStart, datetime_leq: $now }
           ) {
             sum { requests }
             dimensions { actionType }
           }
         }
       }
     }`,
    {
      account: credentials.accountId,
      monthStart: monthStart.toISOString(),
      storageFrom: storageFrom.toISOString(),
      now: now.toISOString(),
    },
  );

  const account = data.viewer.accounts[0];
  if (!account) throw new Error("no such Cloudflare account, or the token cannot read it");

  // Rows arrive newest first, so the first one seen for a bucket is that bucket's latest.
  const latest = new Map<string, number>();
  for (const row of account.storage) {
    if (latest.has(row.dimensions.bucketName)) continue;
    latest.set(
      row.dimensions.bucketName,
      Number(row.max.payloadSize) + Number(row.max.metadataSize),
    );
  }

  const usage: R2Usage = { gb: 0, classA: 0, classB: 0 };
  for (const bytes of latest.values()) usage.gb += bytes / 1e9;
  for (const row of account.operations) {
    const charged = requestClass(row.dimensions.actionType);
    if (charged === "A") usage.classA += Number(row.sum.requests);
    if (charged === "B") usage.classB += Number(row.sum.requests);
  }
  return usage;
}

/* ------------------------------------------------------------------ both, at once */

export interface Costs {
  /** Dollars this cycle, or null if that meter could not be read. */
  railway: number | null;
  r2: number | null;
  /** What R2 is holding and doing, for the headroom line. Null if it could not be read. */
  usage: R2Usage | null;
  /** What answered, added up. A floor rather than the bill whenever `failed` is not empty. */
  total: number;
  /** Railway's limits as they actually read. Null if Railway could not be read at all. */
  limits: { soft: number | null; hard: number | null } | null;
  /** Which meters could not be read, and why. Empty on a healthy run. */
  failed: string[];
}

async function attempt<T>(what: string, run: (() => Promise<T>) | null) {
  if (!run) return { failed: `${what} is not configured` };
  try {
    return await run();
  } catch (error) {
    return { failed: `${what}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Both meters, and never a thrown exception. One unreachable meter must not cost the other;
 * failures land in `failed`, which the watch alerts on, because a blind alarm looks like a cheap month.
 */
export async function costs(credentials: Credentials, now: Date = new Date()): Promise<Costs> {
  // Bound to consts so the closures below narrow, rather than re-reading a nullable property.
  const forRailway = credentials.railway;
  const forCloudflare = credentials.cloudflare;

  const [railway, r2] = await Promise.all([
    attempt("Railway", forRailway && (() => railwaySpend(forRailway))),
    attempt("Cloudflare", forCloudflare && (() => r2Usage(forCloudflare, now))),
  ]);

  const cost: Costs = { railway: null, r2: null, usage: null, total: 0, limits: null, failed: [] };

  if ("failed" in railway) {
    cost.failed.push(railway.failed);
  } else {
    cost.railway = railway.usd;
    cost.limits = { soft: railway.soft, hard: railway.hard };
  }

  if ("failed" in r2) {
    cost.failed.push(r2.failed);
  } else {
    cost.usage = r2;
    cost.r2 = r2Bill(r2);
  }

  cost.total = (cost.railway ?? 0) + (cost.r2 ?? 0);
  return cost;
}

/* ------------------------------------------------------------------ saying it */

const money = (usd: number) => `$${usd.toFixed(2)}`;
const compact = new Intl.NumberFormat("en", { notation: "compact" });

/** Two lines for the morning digest: money, then R2 headroom against the free tier. */
export function costLines(cost: Costs): string[] {
  const source = (name: string, usd: number | null) =>
    `${name} ${usd === null ? "unreadable" : money(usd)}`;

  // A total assembled from one meter is a floor, and has to look like one.
  const floor = cost.failed.length > 0 ? "+" : "";

  // Railway's live hard limit; its absence is printed loudly rather than dropped.
  const ceiling =
    cost.limits?.hard == null ? "· NO HARD STOP SET" : `of ${money(cost.limits.hard)}`;

  const lines = [
    `  ${money(cost.total)}${floor} ${ceiling} this cycle`
      + ` · ${source("Railway", cost.railway)} · ${source("R2", cost.r2)}`,
  ];

  if (cost.usage) {
    lines.push(
      `  ${cost.usage.gb.toFixed(1)} of ${FREE.gb} GB free`
        + ` · ${compact.format(cost.usage.classA)} of ${compact.format(FREE.classA)} writes`
        + ` · ${compact.format(cost.usage.classB)} of ${compact.format(FREE.classB)} reads`,
    );
  }

  return lines;
}
