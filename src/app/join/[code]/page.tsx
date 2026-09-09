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

  // The same guard the page below uses, because this renders first and answers the same
  // question: a tab title carrying somebody's wedding back would confirm the exact code the
  // screen has just refused to confirm, and the guard would be worth nothing.
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

  /*
    This screen is what a roll code is worth: hand it six characters and it tells you whether
    they name a real event. That is the whole enumeration surface, so a caller who keeps
    getting it wrong stops being answered — while a guest arriving with a code off a printed
    card never spends a guess and never notices this is here.
  */
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

  /*
    The top of the only funnel this product has, counted here and nowhere else.

    Below the redirect on purpose, so a "scan" means an invitation shown to somebody who is
    not yet in the roll — a person whose one available next step is to join. Counting above it
    would fold in every guest reopening the card they already accepted, and the ratio the
    number exists for would drift upwards all evening while nothing changed.

    Nothing else needs a counter: the joins it is compared against are `Guest` rows with a
    `createdAt`, which is a better record than a tally in every way except that a scan does
    not leave one. `after`, so a guest waits for their invitation and not for our arithmetic.
  */
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
