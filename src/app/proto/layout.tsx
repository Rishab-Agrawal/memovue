import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProtoShell } from "./components/ProtoShell";

export const metadata: Metadata = {
  title: "Prototype",
  robots: { index: false, follow: false },
};

export default function ProtoLayout({ children }: { children: ReactNode }) {
  return <ProtoShell>{children}</ProtoShell>;
}
