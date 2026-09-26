import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/session";

import { DraftProvider } from "./DraftContext";

/**
 * The wizard is open to everyone, signed in or not.
 *
 * People who have not seen a product yet do not make accounts for it, and nothing here writes
 * anything: the draft lives in the tab until the last step. So the account is asked for at the
 * Create button, where it finally buys something, rather than at the door.
 *
 * `hostName` is the one thing the wizard needs from the server — the invitation card shows it
 * as "Invited by …". Without an account there is no name yet, and "You" is the honest
 * placeholder: the card is a preview of their own invitation.
 */
export default async function WizardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <DraftProvider
      hostName={user?.name ?? "You"}
      hostEmail={user?.email ?? ""}
      signedIn={Boolean(user)}
    >
      {children}
    </DraftProvider>
  );
}
