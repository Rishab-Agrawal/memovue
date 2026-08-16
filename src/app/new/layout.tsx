import type { ReactNode } from "react";

import { requireHost } from "@/lib/session";

import { DraftProvider } from "./DraftContext";

/**
 * Gates the whole wizard and hands it the one thing it needs from the server: the host's
 * name, which the invitation card shows as "Invited by …". Fetching that in the card step
 * would make a client component wait on a round trip to render its own preview.
 */
export default async function WizardLayout({ children }: { children: ReactNode }) {
  const user = await requireHost();
  return <DraftProvider hostName={user.name}>{children}</DraftProvider>;
}
