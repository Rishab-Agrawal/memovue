import { redirect } from "next/navigation";

import { formatCountdown } from "@/lib/format";
import { getGuestContext, getRollByJoinCode } from "@/lib/guest-context";
import { rollPhase } from "@/lib/roll-access";
import { coverUrlFor } from "@/lib/rolls";
import { getCurrentUser } from "@/lib/session";

import { InvitationScreen } from "./InvitationScreen";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const roll = await getRollByJoinCode(code);
  return { title: roll ? roll.name : "Join a roll" };
}

export default async function JoinRollPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const roll = await getRollByJoinCode(code);

  if (!roll) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="display text-[28px] text-chalk">We couldn&rsquo;t find that roll</h1>
        <p className="text-[15px] text-ash">
          Check the link, or ask whoever invited you for a fresh one.
        </p>
      </div>
    );
  }

  // Already in this roll — by a cookie on this device, or by an account that joined on any
  // device. Either way there is no name to ask for.
  const existing = await getGuestContext(roll.code);
  if (existing) redirect(`/e/${roll.code}`);

  const user = await getCurrentUser();
  const now = new Date();

  return (
    <InvitationScreen
      code={roll.code}
      title={roll.name}
      hostName={roll.host.name}
      coverPreset={roll.coverPreset}
      coverUrl={await coverUrlFor(roll)}
      shots={roll.photosPerGuest}
      countdown={formatCountdown(roll.finishesAt.getTime() - now.getTime())}
      phase={rollPhase(roll, now)}
      opensAt={roll.startsAt.toISOString()}
      defaultName={user?.name}
    />
  );
}
