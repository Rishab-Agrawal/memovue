import { NextResponse, type NextRequest } from "next/server";

import { clientIp, rateLimit } from "@/lib/ratelimit";

/**
 * A request ceiling on the two page trees open to anonymous visitors: the create-roll wizard and
 * the sample. Generous, since a real visit is a few dozen requests and a script is thousands.
 *
 * Not on guest routes: a whole wedding shares one venue IP, so those budget wrong guesses
 * instead (see `ratelimit.ts`). Real floods are Cloudflare's job.
 */
const LIMIT = 300;
const WINDOW_SECONDS = 60;

export function proxy(request: NextRequest) {
  const { ok, retryAfterSeconds } = rateLimit(
    `pages:${clientIp(request)}`,
    LIMIT,
    WINDOW_SECONDS,
  );
  if (ok) return NextResponse.next();

  // Plain text: a browser renders this directly.
  return new NextResponse("Too many requests. Try again in a minute.", {
    status: 429,
    headers: { "retry-after": String(retryAfterSeconds), "content-type": "text/plain" },
  });
}

export const config = {
  matcher: ["/new/:path*", "/albums/sample/:path*"],
};
