import type { NextConfig } from "next";

/**
 * Response headers the app has never sent, and one it should not.
 *
 * Cloudflare sits in front of memovue.com and already adds HSTS, so that one is deliberately
 * not repeated here — two sources for the same header is how a max-age ends up wrong. These
 * are the ones nothing else was setting.
 *
 * `frame-ancestors` is the load-bearing one. The host screens are a column of one-tap,
 * irreversible controls — reveal the album early, delete a photograph, delete the roll — and
 * without this any page on the internet could stack an invisible copy of that screen under a
 * button of its own. `X-Frame-Options` says the same thing for browsers that predate CSP.
 *
 * The rest of a content policy is deliberately absent. Next inlines the flight payload as a
 * script, so a real `script-src` needs a per-request nonce, which needs a proxy, which makes
 * every page dynamic — a lot of machinery to add to an app that renders no HTML it did not
 * write and has no `dangerouslySetInnerHTML` anywhere in it.
 */
const security = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  /*
    A roll code is in the path of every invitation link. `strict-origin-when-cross-origin`
    means a guest whose album links out to somewhere else sends only "https://memovue.com",
    never the six characters that would let the reader walk into the roll.
  */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The camera is the product, on our own top-level page and nowhere else. The other two are
  // asked for by nothing here, so anything asking is not us.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

/**
 * Everything a roll code reaches, kept out of search results.
 *
 * `/join/[code]` renders the event's name as its title, so a link forwarded into a public
 * group and crawled would publish both "whose wedding" and a working invitation to it —
 * six characters that admit a stranger to somebody's camera. A header rather than
 * `robots` metadata on each page, because there is one list here and no route can forget it.
 *
 * The marketing pages — `/`, `/welcome`, and the two legal ones — are deliberately not
 * listed, and are the only pages that should ever be found by searching.
 */
const unlisted = [
  "/join/:path*",
  "/e/:path*",
  "/rolls/:path*",
  "/new/:path*",
  "/account/:path*",
  "/admin/:path*",
  "/api/:path*",
];

const nextConfig: NextConfig = {
  // Names the framework and its version to anybody scanning. Nothing reads it.
  poweredByHeader: false,
  // The dev overlay badge sits on top of the guest camera UI and pollutes UI screenshots.
  devIndicators: false,
  // archiver is CommonJS with `module.exports = fn`. Bundling it breaks the callable
  // export; leaving it external lets Node's own CJS interop handle it correctly.
  serverExternalPackages: ["archiver"],
  outputFileTracingIncludes: {
    "/**": ["./prisma/**"],
  },
  headers() {
    return Promise.resolve([
      { source: "/:path*", headers: security },
      ...unlisted.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ]);
  },
};

export default nextConfig;
