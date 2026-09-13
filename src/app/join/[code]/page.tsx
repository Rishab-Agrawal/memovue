import { redirect } from "next/navigation";
import { after } from "next/server";

import { Notice } from "@/components/roll/Chrome";
import { formatCountdown } from "@/lib/format";
import { getGuestContext, getRollByJoinCode } from "@/lib/guest-context";
import { record } from "@/lib/metrics";
import { callerIp, outOfGuesses, wrongGuess } from "@/lib/ratelimit";
import { rollPhase } from "@/lib/roll-access";
import { coverUrlFor } from "@/lib/rolls";
import { getCurrentUser } from "@/lib/session";

import { InvitationScreen } from "./InvitationScreen";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;

  // The same guard as the page, or the tab title would confirm a code the page refuses to.
  if (outOfGuesses(await callerIp())) return { title: "Join a roll" };

  const roll = await getRollByJoinCode(code);
  return { title: roll ? roll.name : "Join a roll" };
}

function NotFound() {
  return (
    <Notice title={<>We couldn&rsquo;t find that roll</>}>
      Check the link, or ask whoever invited you for a fresh one.
    </Notice>
  );
}

export default async function JoinRollPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;

  // This page confirms whether a code exists, so wrong guesses are budgeted per IP.
  const ip = await callerIp();
  if (outOfGuesses(ip)) return <NotFound />;

  const roll = await getRollByJoinCode(code);
  if (!roll) {
    wrongGuess(ip);
    return <NotFound />;
  }

  // Already in this roll — by a cookie on this device, or by an account that joined on any
  // device. Either way there is no name to ask for.
  const existing = await getGuestContext(roll.code);
  if (existing) redirect(`/e/${roll.code}`);

  // The funnel's top: counted below the redirect, so only people not yet in the roll count.
  after(() => record("scan"));

  const user = await getCurrentUser();
  const now = new Date();

  return (
    <InvitationScreen
      code={roll.code}
      title={roll.name}
      hostName={roll.host.name}
      coverPreset={roll.coverPreset}
      coverUrl={coverUrlFor(roll)}
      shots={roll.photosPerGuest}
      countdown={formatCountdown(roll.finishesAt.getTime() - now.getTime())}
      phase={rollPhase(roll, now)}
      opensAt={roll.startsAt.toISOString()}
      defaultName={user?.name}
    />
  );
}
