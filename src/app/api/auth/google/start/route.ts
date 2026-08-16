import { startOAuthState } from "@/lib/auth";
import { buildAuthorizeUrl, isConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Sends the browser to Google, carrying a one-time state we can recognise on the way back. */
export async function GET() {
  if (!isConfigured()) {
    return Response.json(
      { error: "google_not_configured" },
      { status: 503, statusText: "Google sign-in is not configured on this deployment." },
    );
  }

  const state = await startOAuthState();
  return Response.redirect(buildAuthorizeUrl(state), 307);
}
