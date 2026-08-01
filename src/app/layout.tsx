import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";

import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "MemoVue — the disposable camera for your event",
    template: "%s · MemoVue",
  },
  description:
    "Guests shoot on their phones, nobody sees a thing until the event is over. One shared album, everything revealed at once.",
  openGraph: {
    title: "MemoVue — the disposable camera for your event",
    description:
      "Guests shoot on their phones, nobody sees a thing until the event is over. One shared album, everything revealed at once.",
    siteName: "MemoVue",
    type: "website",
  },
  appleWebApp: { capable: true, title: "MemoVue", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a090b",
  colorScheme: "dark",
  // The guest camera runs full-bleed behind the notch and home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${instrumentSerif.variable}`}>
      <body className="grain min-h-dvh bg-ink text-paper">{children}</body>
    </html>
  );
}
