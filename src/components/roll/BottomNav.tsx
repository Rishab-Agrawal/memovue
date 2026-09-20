import Link from "next/link";

import { cn } from "@/lib/cn";

import { Home, Person, Photo } from "@/components/roll/Icons";

/**
 * Three destinations, three equal columns.
 *
 * The two things a host does — start something, look back at something finished — are separate
 * concerns on separate clocks, so they get separate screens and the bar names all three rather
 * than making them compete for one scroll.
 *
 * Labelled, not bare glyphs. A house and a person are guessable on their own; a picture frame
 * standing for "albums" is not, and a bar you have to try is not a bar. The word is 11px under
 * the glyph, so the column still reads as an icon first.
 */
const TABS = [
  { href: "/rolls", label: "Home", key: "rolls", Icon: Home },
  { href: "/albums", label: "Albums", key: "albums", Icon: Photo },
  { href: "/account", label: "You", key: "account", Icon: Person },
] as const;

export function BottomNav({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="box-content flex h-16 shrink-0 items-stretch border-t border-hair bg-page/95 pb-[var(--safe-bottom)] backdrop-blur">
      {TABS.map(({ href, label, key, Icon }) => {
        const here = key === current;
        return (
          <Link
            key={key}
            href={href}
            aria-current={here ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-[color,scale] duration-150 active:scale-[0.94]",
              here ? "text-flame" : "text-dust hover:text-ash",
            )}
          >
            <Icon className="h-[22px] w-[22px]" />
            <span className="text-[11px] leading-none font-medium tracking-wide">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
