import type { Viewport } from "next";
import { redirect } from "next/navigation";

import { GuestApp } from "@/components/guest/GuestApp";
import { getGuestContext } from "@/lib/guest-context";

export const metadata = { title: "Your event" };

// The camera runs edge to edge behind the notch and home indicator.
export const viewport: Viewport = {
  themeColor: "#0a090b",
  viewportFit: "cover",
};

export default async function GuestEventPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  // No valid session for this event — send them through the join screen, which handles
  // "event doesn't exist" and "hasn't started" on its own.
  if (!context) redirect(`/join/${code}`);

  return (
    <GuestApp
      code={context.event.code}
      eventName={context.event.name}
      phase={context.phase}
      shotsLeft={context.shotsLeft}
    />
  );
}
