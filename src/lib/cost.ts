/**
 * What the month is costing, and the two numbers that decide what happens about it.
 *
 * Two meters are running. Railway bills the container, the database and its egress by usage;
 * Cloudflare bills R2 for the bytes stored and the requests made against them. Everything
 * else this app touches is free at our size — Telegram, Google sign-in, DNS, Email Routing,
 * and Resend below three thousand messages a month — or is a fixed annual line that no daily
 * job could usefully watch, which is the domain.
 *
 * **The hard stop is not in this file, and that is the most important sentence here.** Railway
 * takes every workload in the workspace offline by itself once the billing cycle's usage
 * reaches the hard limit set on the account. The platform does that at its own meter: it does
 * not need this repo to have deployed, a cron to still be scheduled, a token to still be
 * valid, or this code to be free of bugs. A kill switch written as "a job notices and calls an
 * API" shares a failure mode with the thing it is guarding — the runaway that stops the job
 * running is the runaway that nothing then stops — so the switch belongs at the meter, and
 * only the *watching* belongs here.
 *
 * That leaves the two things the platform does badly. It announces all of this by email,
 * which is the one channel this project has already decided nobody watches. And a limit set
 * once in somebody else's dashboard can be lowered, raised or removed without anything
 * anywhere throwing an exception — the same shape of failure as a cron that quietly stopped
 * being scheduled, and it gets the same treatment: asserted out loud, every run.
 *
 * Nothing here imports `env` or `server-only`, deliberately. The credentials arrive as an
 * argument, which is what lets the arithmetic below be unit-tested without a bucket or a
 * token — and the arithmetic is the part worth testing, because a free tier applied twice or
 * a class of request charged at the wrong one of two rates produces a number that looks
 * entirely reasonable and is wrong by an order of magnitude.
 */

/*
  There are no Railway thresholds in this file, and that is deliberate.

  They live on the Railway account — the email alert and the hard limit on the Workspace Usage
  page — and are read back live on every run. The account is the only place either number does
  anything: the hard limit is enforced there whatever this repo believes, so a constant here
  that disagreed would not be a stricter policy, only a false one. Worse, a copy in the repo
  turns "raise the limit for a busy month" into a code change, and the first time the two drift
  the alarm cries wolf every four hours until somebody edits a file to agree with a dashboard.

  So the whole ladder is Railway's: its email alert is also the level this alerts to Telegram
  at, and its hard limit is the ceiling every message prints. Change either one in Railway,
  whenever, and nothing here needs touching. The single thing asserted is that both still
  exist, because "no stop at all" is the one state that is never somebody's considered choice.
*/

/**
 * Alert on R2 by itself, regardless of what the two together add up to.
 *
 * Without this, R2 hides inside the combined total, and the case it hides in is exactly the
 * one worth catching: Railway having been stopped by its own hard limit reads as nearly $0, so
 * R2 could climb the whole way to the combined threshold on its own before that line noticed.
 * Cloudflare serves `cdn.memovue.com` from its edge with no part of Railway in the path, so it
 * goes on being billed after everything of ours is offline — and nothing at Cloudflare will
 * stop it, because R2 has no spend cap to set and no usage notification to subscribe to.
 *
 * A constant, unlike the two above, because Cloudflare has no equivalent setting to read back —
 * there is nowhere on that account where a number about R2 spend can be written down. Set well
 * under Railway's email alert so it fires *first* rather than as a footnote to a total Railway
 * would have crossed anyway. Two dollars is not a fraction-of-a-cent tripwire either: it takes
 * 143 GB stored, or 15.6 million reads, or 1.4 million writes, against an app currently at
 * hundredths of a gigabyte and hundreds of reads. Reaching it means a free tier was passed and
 * then kept going.
 */
export const R2_ALERT_USD = 2;

/**
 * R2 Standard, from developers.cloudflare.com/r2/pricing, read 2026-09-05.
 *
 * Egress is absent because it is free, which is the entire reason every image in the app is
 * served through the cached custom domain instead of a signed URL — see `storage.ts`.
 */
const PRICE = { perGbMonth: 0.015, classAPerMillion: 4.5, classBPerMillion: 0.36 };

/** Cloudflare's monthly allowance, granted per account rather than per bucket. */
const FREE = { gb: 10, classA: 1_000_000, classB: 10_000_000 };

/**
 * Which of R2's two request prices an operation is charged at.
 *
 * Reads are Class B and cost a twelfth of a Class A; deletes cost nothing at all. Everything
 * else is counted as Class A rather than matched against a list of names, because Cloudflare
 * adds operations to that list over time — and an operation this function has never heard of
 * should push the estimate up and set the alarm off early, never quietly leave money out of
 * it.
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
 * What R2 charges for a month at this size and this many requests.
 *
 * Storage is priced as a whole month at today's size rather than accrued day by day. That
 * matches a month whose storage was flat and over-states one whose storage grew, which is the
 * correct direction for a number an alarm reads: it answers "what does this cost if it stays
 * like this", and it can never be the reason a threshold is noticed late.
 *
 * The allowances come off the account total, not per bucket, which is why this takes one set
 * of figures for the whole account rather than MemoVue's bucket alone. A second bucket eating
 * the free ten gigabytes makes MemoVue's next gigabyte cost money, and a per-bucket reading
 * would report that as nothing at all.
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

  /*
    Both of these APIs answer 200 with an `errors` array when a token is revoked or not
    permitted, so reading the status line alone would turn a dead credential into a healthy
    zero — which is the single worst way for a cost alarm to fail.
  */
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.data) throw new Error("answered with no data");
  return body.data;
}

interface RailwaySpend {
  /** Dollars used this billing cycle, across every project in the workspace. */
  usd: number;
  /**
   * The account's own two thresholds, live. `soft` is where Railway emails and where this
   * alerts to Telegram; `hard` is where Railway stops every workload. Null means none is set,
   * which for `hard` means nothing anywhere will stop the bill.
   */
  soft: number | null;
  hard: number | null;
}

/**
 * Railway's own figure for this billing cycle, in dollars.
 *
 * This is the number Railway bills and the number Railway's hard limit is compared against,
 * so the alarm here is reading exactly the same meter as the stop — which is the only way the
 * two can be trusted to agree about when it fires.
 *
 * It covers the whole workspace, not this project. That is not a rounding error to gloss
 * over: the workspace holds several projects and the hard limit stops all of them together,
 * so the workspace total is both the honest number and the actionable one.
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
 * The month is UTC, unlike every other date in this app, because Cloudflare's billing month
 * is UTC and this figure has to line up with an invoice rather than with an evening in
 * Kolkata. `format.ts` owns the other clock and is deliberately not used here.
 *
 * Storage is read as the most recent sample rather than summed over the month — it is a level,
 * not a flow, and adding up daily readings of a level counts the same bytes thirty times.
 * Three days of window because the dataset samples periodically and a fresh account can have
 * a gap; ordered newest-first, one row taken per bucket.
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
 * Both meters, and never a thrown exception.
 *
 * One being unreachable must not cost us the other, because they are not the same size:
 * Railway is where all the money is and R2 is a rounding error, so losing the whole reading to
 * a Cloudflare five hundred would be the wrong trade every time. What a failure does instead
 * is land in `failed`, which the watch alerts on — a cost alarm that has gone blind reads
 * exactly like a cheap month, and that is the one thing it must never be mistaken for.
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

/**
 * Two lines for the morning digest, in the same shape as everything around them.
 *
 * The second is headroom rather than money, and it is the more useful of the two for as long
 * as R2 stays inside its allowances: `$0.00` is true every morning and says nothing about how
 * close to stopping being true it is.
 */
export function costLines(cost: Costs): string[] {
  const source = (name: string, usd: number | null) =>
    `${name} ${usd === null ? "unreadable" : money(usd)}`;

  // A total assembled from one meter is a floor, and has to look like one.
  const floor = cost.failed.length > 0 ? "+" : "";

  /*
    The ceiling is Railway's own hard limit, read live rather than restated from a constant, so
    this line cannot go on quoting a figure somebody changed in the dashboard last month. Its
    absence is printed loudly for the same reason: no hard limit is not a smaller number, it is
    no number, and a digest that quietly dropped the ceiling would read like a cheap morning.
  */
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
