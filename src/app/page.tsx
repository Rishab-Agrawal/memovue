import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { Logo, Mark } from "@/components/ui/Logo";

/*
  A copy of `src/app/page.tsx` with one change, made in three places: the header CTA, the
  hero's pair of buttons, and the closing CTA all collapse to a single "Get started" pointing
  at the welcome screen. The reference app's welcome screen replaces its marketing site
  entirely; ours can't, because the marketing page is what explains the product. Unifying the
  calls to action is how the two meet.

  Everything else — copy, layout, the sealed-frame gradients — is untouched.
*/

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

const CLAIMS: { text: string; accent: string }[] = [
  { text: "Guests join via QR code, no install hassle.", accent: "QR code" },
  { text: "Up to twenty-five shots each, like a disposable camera.", accent: "disposable camera" },
  { text: "Photos revealed all at once after the event.", accent: "revealed" },
  { text: "Suited for weddings, parties, team outings, and more.", accent: "weddings" },
];

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

export default function MarketingHome() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-hair px-6 py-3 sm:px-10">
        <Link href="/" aria-label="MemoVue home" className="flex h-11 items-center">
          <Logo />
        </Link>
        <Link
          href="/welcome"
          className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
        >
          Get started
        </Link>
      </header>

      <main className="flex-1">
        {/* ---------------------------------------------------------------- hero */}
        <section className="bloom px-6 pt-16 pb-20 sm:px-10 sm:pt-24 sm:pb-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
            <div>
              <h1 className="display animate-rise text-[clamp(3rem,12vw,5.5rem)] text-chalk">
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
                <ButtonLink href="/welcome" size="lg">
                  Get started
                </ButtonLink>
              </div>

              <p
                className="animate-fade mt-8 text-[13px] text-dust"
                style={{ animationDelay: "340ms" }}
              >
                Free while we&rsquo;re in beta.
              </p>
            </div>

            <div className="order-first flex justify-center lg:order-last lg:justify-end">
              <Mark animate glow className="h-44 w-auto sm:h-56 lg:h-72" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- steps */}
        <section className="border-t border-hair px-6 sm:px-10">
          <ol className="mx-auto max-w-5xl">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="grid items-baseline gap-x-8 gap-y-3 border-b border-hair py-11 last:border-b-0 sm:grid-cols-[auto_1fr_1.4fr] sm:gap-x-10"
              >
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

            <figure className="mx-auto w-full max-w-[19rem] lg:max-w-[22rem]">
              <div
                className="grid grid-cols-3 gap-px border border-hair bg-hair p-px"
                aria-hidden="true"
              >
                {SEALED_FRAMES.map((frame, index) => (
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
            <ButtonLink href="/welcome" size="lg" className="mt-2">
              Get started
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
