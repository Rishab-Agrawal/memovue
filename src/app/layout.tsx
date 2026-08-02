import type { Metadata, Viewport } from "next";
import { Archivo, Bricolage_Grotesque } from "next/font/google";

import "./globals.css";

/**
 * Two faces, and no monospace.
 *
 * Bricolage Grotesque carries the headlines: a display sans with genuinely irregular
 * terminals, which echoes the hand-drawn logo. A high-contrast serif was the obvious
 * choice here and that is precisely the problem — it is the default for this category.
 *
 * Archivo carries everything else, including numbers via tabular figures. Dropping the
 * monospace removed both the slashed zero and the engineering flavour it brought with it.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "MemoVue — everyone's photos, one album",
    template: "%s · MemoVue",
  },
  description:
    "Your guests shoot your event on their own phones. Everything lands in one shared album, with every photo credited to whoever took it.",
  openGraph: {
    title: "MemoVue — everyone's photos, one album",
    description:
      "Your guests shoot your event on their own phones. Everything lands in one shared album, with every photo credited to whoever took it.",
    siteName: "MemoVue",
    type: "website",
  },
  appleWebApp: { capable: true, title: "MemoVue", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  // The guest camera runs full-bleed behind the notch and home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${archivo.variable}`}>
      <body className="grain min-h-dvh bg-void text-chalk">{children}</body>
    </html>
  );
}
