import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { Logo, Mark } from "@/components/ui/Logo";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Set it up",
    body: "Name your event and choose how many shots each guest gets. It takes about a minute.",
  },
  {
    title: "Share one code",
    body: "Print it for the tables or send it in the group chat. Guests scan and start shooting — no app, no sign-up.",
  },
  {
    title: "Get the album",
    body: "Every photo, from every guest, in one place and in full quality.",
  },
];

/**
 * These used to be one section that showed a single line at a time on an 8.8-second loop.
 *
 * Three things were wrong with that. Copy this important shouldn't have to be waited for —
 * a visitor who scrolls past at the wrong second reads one quarter of the pitch and leaves.
 * Anyone landing mid-transition sees a half-faded grey line, which reads as a rendering bug
 * rather than as motion. And the section reserved a full screen of height to display one
 * sentence. Four short claims, all legible at once, is strictly more information in less
 * space, and nothing has to be timed to the number of them any more.
 */
const CLAIMS: { text: string; accent: string }[] = [
  { text: "Guests join via QR code, no install hassle.", accent: "QR code" },
  { text: "Up to twenty-five shots each, like a disposable camera.", accent: "disposable camera" },
  { text: "Photos revealed all at once after the event.", accent: "revealed" },
  { text: "Suited for weddings, parties, team outings, and more.", accent: "weddings" },
];

/**
 * `accent` is the phrase set in orange — kept as a substring of `text` rather than pre-split
 * markup so the copy stays readable and editable as a plain sentence.
 */
function withAccent(text: string, accent: string) {
  const at = text.indexOf(accent);
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-flame">{accent}</span>
      {text.slice(at + accent.length)}
    </>
  );
}

/**
 * The one thing the page was never showing: what a guest is actually looking at for most of
 * the event.
 *
 * A product whose entire promise is "you can't see the photos yet" was describing that in
 * prose and illustrating it with nothing. This is the real pre-reveal state — frames present,
 * accounted for, and blurred past legibility — so it demonstrates the mechanic without
 * standing in for photographs that don't exist. Nine soft washes on black, which is what a
 * 32px placeholder scaled up genuinely looks like.
 */
const SEALED_FRAMES = [
  "radial-gradient(120% 100% at 30% 25%, #6b3d12, #1a1108 70%)",
  "radial-gradient(120% 100% at 70% 40%, #4a3a2e, #120f0c 72%)",
  "radial-gradient(110% 110% at 40% 70%, #7a4a17, #1c1309 68%)",
  "radial-gradient(120% 100% at 60% 20%, #33302c, #0e0d0c 70%)",
  "radial-gradient(130% 100% at 25% 55%, #8a5520, #20150a 66%)",
  "radial-gradient(110% 100% at 75% 65%, #45392f, #14100c 72%)",
  "radial-gradient(120% 110% at 50% 35%, #5c4326, #16110b 70%)",
  "radial-gradient(120% 100% at 35% 75%, #7d4a1a, #1d1409 68%)",
  "radial-gradient(110% 100% at 65% 30%, #3b3630, #100f0d 72%)",
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-hair px-6 py-3 sm:px-10">
        <Link href="/" aria-label="MemoVue home" className="flex h-11 items-center">
          <Logo />
        </Link>
        <Link
          href="/login"
          className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        {/* ---------------------------------------------------------------- hero */}
        <section className="bloom px-6 pt-16 pb-20 sm:px-10 sm:pt-24 sm:pb-28">
          {/* The left column has to stay wide enough for "Every memory," to hold one line —
              the explicit break in the headline assumes two lines, not three. */}
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
            <div>
              <h1 className="display animate-rise text-[clamp(3rem,12vw,5.5rem)] text-chalk">
                {/* Trailing space before the break, or the heading's text content reads
                    "Every memory,one album." to screen readers and copy-paste. */}
                Every memory,{" "}
                <br />
                <span className="text-flame">one album.</span>
              </h1>

              <p
                className="animate-rise mt-7 max-w-md text-[17px] leading-relaxed text-ash"
                style={{ animationDelay: "120ms" }}
              >
                Your guests shoot your event on their own phones. Every photo lands in one shared
                album, credited to whoever took it.
              </p>

              <div
                className="animate-rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-2"
                style={{ animationDelay: "220ms" }}
              >
                <ButtonLink href="/signup" size="lg">
                  Create an event
                </ButtonLink>
                <Link
                  href="/join"
                  className="flex h-12 items-center border-b border-hair-bright px-1 text-[14px] text-ash transition-colors hover:border-flame hover:text-chalk"
                >
                  I have a code
                </Link>
              </div>

              <p
                className="animate-fade mt-8 text-[13px] text-dust"
                style={{ animationDelay: "340ms" }}
              >
                Free while we&rsquo;re in beta.
              </p>
            </div>

            {/* The mark is the hero image. Four viewpoints, one root — it draws itself in. */}
            <div className="order-first flex justify-center lg:order-last lg:justify-end">
              <Mark animate glow className="h-44 w-auto sm:h-56 lg:h-72" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- steps */}
        {/*
          Numbered, and the figure carries the left column.

          Three untitled text rows in a two-column grid left most of a desktop screen empty
          and gave no signal that they were a sequence rather than three unrelated features.
        */}
        <section className="border-t border-hair px-6 sm:px-10">
          <ol className="mx-auto max-w-5xl">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="grid items-baseline gap-x-8 gap-y-3 border-b border-hair py-11 last:border-b-0 sm:grid-cols-[auto_1fr_1.4fr] sm:gap-x-10"
              >
                {/* Neutral, not a faded orange. Dropping the accent to a third of its
                    opacity on near-black doesn't read as a quiet orange, it reads as brown. */}
                <span
                  className="display tabular text-[2.4rem] leading-none text-dust sm:text-[3rem]"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <h2 className="display-md text-[1.7rem] text-chalk">{step.title}</h2>
                <p className="max-w-prose text-[16px] leading-relaxed text-ash">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- sealed */}
        <section className="border-t border-hair px-6 py-20 sm:px-10 sm:py-28">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-20">
            <div>
              <p className="marking text-flame">Until the reveal</p>
              <h2 className="display mt-5 max-w-md text-[clamp(2rem,7vw,3rem)] text-chalk">
                Nobody sees a thing.
              </h2>
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ash">
                Not the guests, not even you. Every frame goes straight to sealed storage and
                stays there until the time you picked — then the whole album opens at once, for
                everyone who was there.
              </p>

              <ul className="mt-10 max-w-md border-t border-hair">
                {CLAIMS.map((claim) => (
                  <li
                    key={claim.text}
                    className="border-b border-hair py-4 text-[17px] leading-snug text-chalk"
                  >
                    {withAccent(claim.text, claim.accent)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Not a mockup of photos — the actual sealed state, which is unreadable by design. */}
            <figure className="mx-auto w-full max-w-[19rem] lg:max-w-[22rem]">
              <div
                className="grid grid-cols-3 gap-px border border-hair bg-hair p-px"
                aria-hidden="true"
              >
                {SEALED_FRAMES.map((frame, index) => (
                  /*
                    Each frame clips its own blur. Blurring the cells directly let the haze
                    spill across the hairline gaps and the nine frames merged into one soft
                    rectangle — which loses the entire point, that these are individual
                    photographs sitting there unviewable. The inner plate is oversized so the
                    blur has material to pull from at the edges instead of fading to nothing.
                  */
                  <span key={index} className="relative aspect-square overflow-hidden bg-void">
                    <span
                      className="absolute -inset-4 block"
                      style={{ backgroundImage: frame, filter: "blur(10px) saturate(0.8)" }}
                    />
                  </span>
                ))}
              </div>
              <figcaption className="marking mt-4 block text-center">
                47 photos · sealed until 11:00
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ---------------------------------------------------------------- closing */}
        <section className="bloom border-t border-hair px-6 py-24 sm:px-10">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-7">
            <Mark className="h-11 w-auto" glow />
            <h2 className="display max-w-xl text-[clamp(2.2rem,7vw,3.4rem)] text-chalk">
              The parts you <span className="text-flame">missed.</span>
            </h2>
            <p className="max-w-sm text-[16px] leading-relaxed text-ash">
              You can&rsquo;t be in every room. Your guests are.
            </p>
            <ButtonLink href="/signup" size="lg" className="mt-2">
              Create an event
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-hair px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-x-6 gap-y-1">
            {[
              ["Terms", "/terms"],
              ["Privacy", "/privacy"],
              ["Join", "/join"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
              >
                {label}
              </Link>
            ))}
            <a
              href="mailto:hello@memovue.com"
              className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
            >
              Contact
            </a>
          </nav>
        </div>
        <p className="tabular mx-auto mt-6 max-w-5xl text-[12px] text-dust">
          © {new Date().getFullYear()} MemoVue
        </p>
      </footer>
    </div>
  );
}
