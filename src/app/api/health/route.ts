import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * What Railway asks before it puts a new container in front of anybody.
 *
 * Without a health check a deploy goes live the moment the port opens, which is earlier than
 * "the app works" — a container missing `AUTH_SECRET` binds its port perfectly well and then
 * throws on every render, and the first person to find out is a guest. Reading `env` is the
 * check rather than decoration: that module validates its configuration at import and throws
 * on anything missing, so a misconfigured build fails here and the previous deploy stays up.
 *
 * Deliberately does not touch the database. `npm start` runs `prisma migrate deploy` before
 * `next start`, so a container that cannot reach Postgres never gets as far as answering
 * this — and a query here would be one more thing to run on every probe for an answer that
 * has already been given.
 */
export function GET() {
  // Whether this container believes it is production is worth being able to ask: it is what
  // decides `Secure` on every session cookie and which key prefix the bucket is written under.
  return Response.json({ ok: true, production: env.isProduction });
}
