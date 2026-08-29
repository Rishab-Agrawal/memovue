import { redirect } from "next/navigation";

import { GuestApp } from "@/components/guest/GuestApp";
import { getGuestContext } from "@/lib/guest-context";
import { getCurrentUser } from "@/lib/session";

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

  /*
    Where the camera's back button goes. The host owns this roll and has its screen; a guest
    with an account has their own list; an anonymous guest has neither, and gets no button.
  */
  const user = await getCurrentUser();
  const home = !user
    ? null
    : user.id === context.roll.hostId
      ? `/rolls/${context.roll.id}`
      : "/rolls";

  return (
    <GuestApp
      code={context.roll.code}
      rollName={context.roll.name}
      capturing={context.capturing}
      shotsLeft={context.shotsLeft}
      home={home}
    />
  );
}
