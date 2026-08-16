import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";

import "./globals.css";

/**
 * One typeface.
 *
 * Two previous attempts overshot in opposite directions: a high-contrast serif, which is
 * the default for anything wedding-adjacent, then a quirky display sans, which read as
 * childish. Hierarchy here comes from weight and scale rather than from a second face —
 * which is both more grounded and a more deliberate constraint than adding another font.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "MemoVue — every memory, one album",
    template: "%s · MemoVue",
  },
  description:
    "Your guests shoot your event on their own phones. Every photo lands in one shared album, credited to whoever took it.",
  openGraph: {
    title: "MemoVue — every memory, one album",
    description:
      "Your guests shoot your event on their own phones. Every photo lands in one shared album, credited to whoever took it.",
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
    <html lang="en" className={archivo.variable}>
      <body className="grain min-h-dvh bg-page text-chalk">{children}</body>
    </html>
  );
}
