import type { Metadata, Viewport } from "next";
import { Archivo, DM_Mono, Fraunces } from "next/font/google";

import "./globals.css";

/**
 * Three faces, three jobs.
 *
 * Fraunces carries emotion — it's a variable serif with SOFT and WONK axes that make the
 * letterforms slightly irregular at display sizes, which matches the hand-drawn logo.
 * Archivo carries prose. DM Mono carries data: counters, timestamps, field labels.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "MemoVue — everyone's camera, one album",
    template: "%s · MemoVue",
  },
  description:
    "Guests shoot your event on their own phones. Nothing is visible — to anyone, including you — until it all unlocks at once.",
  openGraph: {
    title: "MemoVue — everyone's camera, one album",
    description:
      "Guests shoot your event on their own phones. Nothing is visible — to anyone, including you — until it all unlocks at once.",
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
    <html
      lang="en"
      className={`${fraunces.variable} ${archivo.variable} ${dmMono.variable}`}
    >
      <body className="grain min-h-dvh bg-void text-chalk">{children}</body>
    </html>
  );
}
