import Link from "next/link";

import { BackButton, SettingsButton } from "@/components/roll/Chrome";
import { SponsorCard } from "@/components/roll/Sponsor";
import { formatDay, formatDuration } from "@/lib/format";
import type { Sponsor } from "@/lib/referrals";

/**
 * The top of a roll, shared by the host's roll home and the guest's album: the name, one line
 * of status, and two figures. No cover, so the first photographs stay above the fold.
 *
 * The status counts down to the close while shooting, to the reveal while sealed, and shows the
 * end date once open.
 */
export function RollHeader({
  title,
  moments,
  people,
  finishesAt,
  revealAt,
  open,
  now,
  back,
  settingsHref,
  peopleHref,
  sponsor,
}: {
  title: string;
  moments: number;
  people: number;
  /** Epoch milliseconds — one caller holds Dates, the other ISO strings off a JSON feed. */
  finishesAt: number;
  revealAt: number;
  /** Whether the photographs are legible yet. */
  open: boolean;
  now: number;
  /** Absent for a guest with no account, who has no screen of ours behind this one. */
  back?: string;
  /** Absent for guests, who have no settings to open. */
  settingsHref?: string;
  peopleHref?: string;
  /**
   * The wedding business whose referral code created this roll.
   *
   * It lives in the header rather than below the controls because this is the block a guest
   * actually looks at — the name of the wedding and how long is left — and a card under the
   * buttons was one scroll away from never being seen.
   */
  sponsor?: Sponsor | null;
}) {
  // Running first: a roll revealed early is open but still shooting. `lead`/`trail` because
  // the figure moves within the sentence — "2d 4h until it closes" but "Ended 6 Sep".
  const timing =
    now < finishesAt
      ? { value: formatDuration(finishesAt - now), trail: "until it closes" }
      : open
        ? { lead: "Ended", value: formatDay(new Date(finishesAt)) }
        : { value: formatDuration(revealAt - now), trail: "until it opens" };

  return (
    // The glow spans the whole header, so it has no visible edge under the buttons.
    <div className="bloom shrink-0">
      {/* The empty span keeps the settings button right-aligned and the row's padding when there is no back button. */}
      <div className="pad-safe-top flex items-start justify-between px-4">
        {back ? <BackButton href={back} /> : <span />}
        {settingsHref ? <SettingsButton href={settingsHref} /> : null}
      </div>

      <div className="px-5 pt-8 pb-10 text-center">
        <h1 className="display text-[34px] text-balance text-chalk">{title}</h1>
        <p className="mt-4 text-[14px] text-ash">
          {"lead" in timing ? `${timing.lead} ` : null}
          <span className="tabular text-chalk">{timing.value}</span>
          {"trail" in timing ? ` ${timing.trail}` : null}
        </p>

        {/* Left-aligned inside a centred block: the card is a row, not a caption. */}
        {sponsor ? (
          <div className="mt-8 text-left">
            <SponsorCard {...sponsor} />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-y border-hair px-5 py-3.5 text-[13px] text-dust">
        <Figure value={moments} noun="moment" />
        <Figure value={people} noun="person" plural="people" href={peopleHref} />
      </div>
    </div>
  );
}

function Figure({
  value,
  noun,
  plural,
  href,
}: {
  value: number;
  noun: string;
  /** For the nouns an `s` will not make plural. */
  plural?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="tabular text-chalk">{value}</span>{" "}
      {value === 1 ? noun : (plural ?? `${noun}s`)}
      {href ? <span className="ml-1.5">›</span> : null}
    </>
  );

  if (!href) return <span>{body}</span>;

  return (
    <Link href={href} className="transition-colors hover:text-flame">
      {body}
    </Link>
  );
}
