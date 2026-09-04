import { startOAuthState } from "@/lib/auth";
import { env } from "@/lib/env";
import { buildAuthorizeUrl, isConfigured } from "@/lib/google";
import { OAUTH_LIMIT, OAUTH_WINDOW_SECONDS, clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Sends the browser to Google, carrying a one-time state we can recognise on the way back. */
export async function GET(request: Request) {
  if (!isConfigured()) {
    return Response.json(
      { error: "google_not_configured" },
      { status: 503, statusText: "Google sign-in is not configured on this deployment." },
    );
  }

  // A refusal a browser lands on, not one a program parses: this route is an anchor on the
  // welcome screen, so a 429 body would render as the app apparently breaking.
  if (!rateLimit(`oauth:${clientIp(request)}`, OAUTH_LIMIT, OAUTH_WINDOW_SECONDS).ok) {
    return Response.redirect(`${env.appUrl}/welcome?error=too_many`, 307);
  }

  const state = await startOAuthState();
  return Response.redirect(buildAuthorizeUrl(state), 307);
}
