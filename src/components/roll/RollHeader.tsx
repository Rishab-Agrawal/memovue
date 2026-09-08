import Link from "next/link";

import { BackButton, SettingsButton } from "@/components/roll/Chrome";
import { formatDay, formatDuration } from "@/lib/format";

/**
 * The top of a roll: what it is, what happens to it next, and the two figures worth glancing
 * at. Shared by the host's roll home and the guest's album, which are the same screen with
 * different permissions.
 *
 * **No cover.** This screen's content is the photographs on it, and a 215px picture of
 * something else pushed the first row of them below the fold on every phone. The cover has
 * three other homes — the home card, the invitation, the settings screen — and the host has
 * already seen it in all of them.
 *
 * **The name is the masthead.** Below it, one line of status; below that, a quiet bar holding
 * the two figures — where the one that leads somewhere sits at the end of the row with a
 * chevron, rather than buried mid-sentence between two that do not. The version this replaces
 * stood `Moments`, `Left` and `People` in equal columns, which is a lie about how much each
 * one matters: the count creeps up over an evening, the guest list barely moves, and the
 * clock is the reason the screen was opened at all.
 *
 * **What the clock counts changes with the roll.** Still shooting: how long is left. Closed
 * but sealed: how long until it opens — which is the only question anybody is asking then,
 * and which the old header answered with the date it had already closed on. Open: the day it
 * ended, because there is nothing left to wait for.
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
}) {
  /* Still running is checked first: a host who revealed early has an open roll whose shutter
     has not closed yet, and "ended" would be the one wrong word for it.

     `lead` and `trail` rather than one label, because the figure does not sit in the same
     place in all three sentences — "2d 4h until it closes" but "Ended 6 Sep". */
  const timing =
    now < finishesAt
      ? { value: formatDuration(finishesAt - now), trail: "until it closes" }
      : open
        ? { lead: "Ended", value: formatDay(new Date(finishesAt)) }
        : { value: formatDuration(revealAt - now), trail: "until it opens" };

  return (
    /* The glow belongs to the whole header, not to the title block inside it: lit from below
       the back and settings buttons it had a visible ceiling across the top of the screen,
       which read as a banner rather than as light. */
    <div className="bloom shrink-0">
      {/* `justify-end` needs something to push against when there is no back button, and a
          row with neither still holds the top padding this header is measured from. */}
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
