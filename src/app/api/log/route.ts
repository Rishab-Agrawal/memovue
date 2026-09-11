import { after } from "next/server";

import { browserFault } from "@/lib/alert-text";
import { record } from "@/lib/metrics";
import { clientIp, limited } from "@/lib/ratelimit";
import { alert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Where a browser says it crashed.
 *
 * The one route in the app that exists to be told something by an anonymous stranger, which
 * is why almost all of it is limits. Everything that arrives is clamped to a length and sent
 * on as plain text — `notify` sets no `parse_mode` precisely so that a string chosen by
 * somebody else cannot become formatting, a link, or a mention.
 *
 * Twenty an hour per address is far above what a genuinely broken page produces, since the
 * browser already caps itself at five per page load; the alert deduplication behind this caps
 * it again across everybody, so one bad deploy is a handful of messages rather than a flood.
 */
export async function POST(request: Request) {
  const over = limited(`log:${clientIp(request)}`, 20, 3_600);
  if (over) return over;

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) return new Response(null, { status: 204 });

  const { message, source, path } = body as Record<string, unknown>;
  // Clamped rather than schema-validated: there is nothing here to be well-formed, only text
  // to be short. A length is the whole contract.
  const text = String(message ?? "").slice(0, 300).trim();
  if (!text) return new Response(null, { status: 204 });

  const where = String(path ?? "").slice(0, 120);
  const how = String(source ?? "").slice(0, 20);

  // After the response, because the browser is not waiting for this and a beacon has already
  // been forgotten by the page that sent it.
  after(async () => {
    await Promise.all([
      record("client_error"),
      alert(`client|${where}|${text.slice(0, 120)}`, browserFault(where, how, text)),
    ]);
  });

  return new Response(null, { status: 204 });
}
