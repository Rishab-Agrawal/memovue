import { NextResponse, type NextRequest } from "next/server";

import { clientIp, rateLimit } from "@/lib/ratelimit";

/**
 * A ceiling on the two doors that opened to strangers.
 *
 * Neither the wizard nor the sample writes anything — the draft lives in the tab until the
 * Create button, and the sample camera throws its frames away — so there is no allowance to
 * spend and no row to insert. What a script can still do is make us render pages, and these
 * are the two places in the app where that is now possible without an account.
 *
 * **Not applied to the guest routes, deliberately.** Two hundred people at a wedding scanning
 * the card on their table share one venue address, and a per-request budget there is the
 * instrument `ratelimit.ts` explains at length that we must not use: any limit tight enough
 * to stop a script would close the door on the event it was protecting. `/join` and `/e`
 * spend a budget on wrong answers instead, which is a thing a venue full of guests never
 * does. Nobody loads the create-roll wizard a hundred times in a minute, so it can be
 * counted the ordinary way.
 *
 * This is a floor, not a wall. memovue.com is proxied through Cloudflare, and anything that
 * looks like an actual flood is its job rather than ours.
 *
 * Three hundred rather than a tight number, for the same reason the guest routes are left
 * out: the cost of being wrong is asymmetric. A host walking the wizard end to end spends
 * perhaps fifteen of these with prefetches counted, and several people behind one office or
 * hotel address still do not approach it — while a script does thousands, and is refused
 * just as thoroughly at three hundred as at ten.
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

  // Plain text, not JSON: a browser lands on this, so a parsed error body would render as
  // the app apparently breaking.
  return new NextResponse("Too many requests. Try again in a minute.", {
    status: 429,
    headers: { "retry-after": String(retryAfterSeconds), "content-type": "text/plain" },
  });
}

export const config = {
  matcher: ["/new/:path*", "/albums/sample/:path*"],
};
