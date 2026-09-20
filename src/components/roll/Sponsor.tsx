"use client";

import { useState } from "react";

import type { Sponsor } from "@/lib/referrals";

/**
 * The wedding business whose referral code created this roll, on the roll's home screen — the
 * one screen every guest passes through, and keeps coming back to while the album fills.
 *
 * It is an advertisement, so it has to be found; it sits in somebody's wedding album, so it has
 * to behave. It gets one card in the app's own surface, between the controls and the photographs,
 * and nothing else: no colour of its own, no animation, nothing that moves as the page loads.
 *
 * The logo is hosted by the business, not by us, which is the deal — we never took a copy. A URL
 * that has rotted takes the picture out of the card and leaves the name, rather than leaving a
 * broken-image glyph on a wedding album for the next thirty days.
 */
export function SponsorCard({ name, url, logoUrl }: Sponsor) {
  const [logoLost, setLogoLost] = useState(false);

  const logo =
    logoUrl && !logoLost ? (
      // Not next/image: the bytes are on a domain we do not own and have never seen.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        onError={() => setLogoLost(true)}
        /*
          On a light plate, not on the page.

          A logo arrives as whatever the business had — usually dark ink on transparency, drawn
          for letterheads — and on a black screen half of them would simply not be there. White
          behind it costs a small card-shaped rectangle and is the only background that a logo
          we have never seen is likely to have been designed against.
        */
        className="h-12 w-12 shrink-0 rounded-xl bg-chalk object-contain p-1.5"
      />
    ) : null;

  const body = (
    <>
      {logo}
      <span className="min-w-0 flex-1">
        <span className="marking block">Brought to you by</span>
        <span className="display-sm mt-1 block truncate text-[17px] text-chalk">{name}</span>
        {url ? <span className="mt-0.5 block truncate text-[13px] text-flame">{host(url)}</span> : null}
      </span>
      {url ? (
        <span className="shrink-0 text-[16px] text-dust" aria-hidden="true">
          ↗
        </span>
      ) : null}
    </>
  );

  const shell = "flex items-center gap-4 rounded-2xl bg-surface px-4 py-3.5";

  // A business with no site is still named; only one with somewhere to go becomes a link.
  if (!url) return <div className={shell}>{body}</div>;

  return (
    <a
      href={url}
      target="_blank"
      // `noopener` matters: this URL was typed into an admin screen, not written here.
      rel="noopener noreferrer nofollow"
      className={`${shell} transition-[background-color,scale] duration-150 hover:bg-hair-bright active:scale-[0.98]`}
    >
      {body}
    </a>
  );
}

/** "https://www.bloomevents.in/weddings" → "bloomevents.in". The address, not the path. */
function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
