import Link from "next/link";

import { BackButton } from "@/components/roll/Chrome";
import { Cover } from "@/components/roll/Cover";

/**
 * The cover, the title and the three figures, shared by the host's roll home and the guest's
 * album — they are the same screen with different permissions, and were the same component
 * in the reference too.
 */
export function RollHeader({
  title,
  coverIndex,
  coverUrl,
  moments,
  people,
  middleValue,
  middleLabel,
  back,
  settingsHref,
  peopleHref,
}: {
  title: string;
  coverIndex: number;
  /** The host's uploaded cover, if they set one. Null falls back to the preset. */
  coverUrl?: string | null;
  moments: number;
  people: number;
  /** The countdown while the roll runs, the closing date once it has ended. */
  middleValue: string;
  middleLabel: string;
  back: string;
  /** Absent for guests, who have no settings to open. */
  settingsHref?: string;
  /** Absent for guests — the roster is the host's business, not theirs. */
  peopleHref?: string;
}) {
  return (
    <div className="relative h-[290px] shrink-0">
      <Cover url={coverUrl} preset={coverIndex} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-void/60 via-transparent to-void/85" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <BackButton href={back} />
        {settingsHref ? (
          <Link
            href={settingsHref}
            aria-label="Roll settings"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/70 text-[18px] text-chalk backdrop-blur-sm transition-colors hover:text-flame"
          >
            ⚙
          </Link>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
        <h1 className="display-md text-center text-[26px] text-balance text-chalk">{title}</h1>

        <div className="mt-4 grid grid-cols-3 text-center">
          <Stat value={String(moments)} label="Moments" />
          <Stat value={middleValue} label={middleLabel} />
          <Stat
            value={String(people)}
            label={peopleHref ? "People ›" : "People"}
            href={peopleHref}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, href }: { value: string; label: string; href?: string }) {
  const body = (
    <>
      <p className="display-md tabular text-[20px] text-chalk italic">{value}</p>
      <p className="mt-0.5 text-[13px] text-chalk/60">{label}</p>
    </>
  );

  if (!href) return <div>{body}</div>;

  return (
    <Link href={href} className="transition-colors hover:text-flame">
      {body}
    </Link>
  );
}
