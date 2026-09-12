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

  /*
    Where to land afterwards, resolved against our own origin and kept only if it stayed
    there. The parameter arrives on a public query string, so an absolute URL or a
    protocol-relative one would make this an open redirect wearing our own domain.

    The wizard is what asks for it: somebody who filled in five steps before signing in is
    owed the Create button they were standing on, not the home screen.
  */
  const home = new URL(env.appUrl);
  const asked = new URL(new URL(request.url).searchParams.get("next") ?? "/rolls", home);
  // Path and query, no more: the wizard's `?create=1` is half the instruction, and a
  // fragment is never sent to a server in the first place.
  const next = asked.origin === home.origin ? asked.pathname + asked.search : "/rolls";

  const state = await startOAuthState(next);
  return Response.redirect(buildAuthorizeUrl(state), 307);
}
