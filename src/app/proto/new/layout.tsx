import type { ReactNode } from "react";

import { DraftProvider } from "./DraftContext";

export default function WizardLayout({ children }: { children: ReactNode }) {
  return <DraftProvider>{children}</DraftProvider>;
}
