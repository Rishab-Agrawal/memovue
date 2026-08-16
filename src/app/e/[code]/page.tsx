import { redirect } from "next/navigation";

import { GuestApp } from "@/components/guest/GuestApp";
import { getGuestContext } from "@/lib/guest-context";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const context = await getGuestContext(code);
  return { title: context ? context.roll.name : "MemoVue" };
}

export default async function GuestRollPage({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;

  const context = await getGuestContext(code);
  // No session for this roll — the join screen is where a name gets attached to a camera.
  if (!context) redirect(`/join/${code}`);

  return (
    <GuestApp
      code={context.roll.code}
      rollName={context.roll.name}
      capturing={context.capturing}
      shotsLeft={context.shotsLeft}
    />
  );
}
