import Link from "next/link";

import { Plate } from "@/components/roll/Plate";
import { ButtonLink } from "@/components/ui/Button";
import { Logo, Mark } from "@/components/ui/Logo";
import { FRAMES, WALL } from "@/lib/imagery";

/*
  The marketing page.

  It diverges from the reference app in one structural way: every call to action here — header,
  hero, closing — points at the welcome screen. The reference app replaces its marketing site
  with its welcome screen entirely; ours cannot, because this page is what explains the
  product. Unifying the calls to action is how the two meet.
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

/*
  Three prints fanned out and credited, the way they come back from a lab.

  The hero used to hold the mark alone, which showed a visitor the logo rather than the
  product. What has to be legible in the first second is that these are photographs other
  people took of your evening — hence the names in the corners.

  The tilt is inline rather than a class because `animate-rise` finishes on `transform: none`,
  and a rotation sharing that element would be wiped the moment the animation lands. The
  wrapper animates; the prints only lean.

  The two behind carry their credit at the top, the one in front at the bottom. Uniform
  placement put the rear names underneath the front print, where a name is not a credit so
  much as litter in the markup — each label sits on the edge of its own print that the stack
  actually leaves showing.
*/
const HERO: { photo: (typeof FRAMES)[number]; by: string; place: string; tilt: number }[] = [
  { photo: FRAMES[2], by: "Arjun", place: "top-6 left-0 w-[56%]", tilt: -7 },
  { photo: FRAMES[3], by: "Nikhil", place: "top-0 right-0 w-[52%]", tilt: 6 },
  { photo: FRAMES[0], by: "Meera", place: "bottom-0 left-[20%] w-[60%]", tilt: -2 },
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
            </div>

            <div className="order-first flex justify-center lg:order-last lg:justify-end">
              <div
                className="animate-rise relative h-[20rem] w-[16rem] sm:h-[24rem] sm:w-[19rem] lg:h-[27rem] lg:w-[22rem]"
                style={{ animationDelay: "160ms" }}
              >
                {HERO.map((print, index) => (
                  <figure
                    key={print.by}
                    className={`absolute ${print.place}`}
                    style={{ transform: `rotate(${print.tilt}deg)` }}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-xl shadow-[0_24px_48px_rgba(0,0,0,0.6)] ring-1 ring-hair-bright">
                      <Plate photo={print.photo} className="absolute inset-0" />
                      <figcaption
                        className={`absolute left-3 text-[13px] text-chalk/85 italic drop-shadow ${
                          index === HERO.length - 1 ? "bottom-2" : "top-2"
                        }`}
                      >
                        {print.by}
                      </figcaption>
                    </div>
                  </figure>
                ))}
              </div>
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

        {/* ---------------------------------------------------------------- reveal */}
        <section className="border-t border-hair px-6 py-20 sm:px-10 sm:py-28">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-20">
            <div>
              <p className="marking text-flame">Worth the wait</p>
              <h2 className="display mt-5 max-w-md text-[clamp(2rem,7vw,3rem)] text-chalk">
                Everything lands at <span className="text-flame">the reveal.</span>
              </h2>
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ash">
                While the night is happening the photos stay sealed, so nobody spends it
                scrolling. At the time you picked, every frame from every guest opens at once —
                and the first time anyone sees the evening is the moment everyone does.
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
              {/* Real photographs, blurred by exactly the filter the app puts on a sealed
                  roll — so what a visitor sees here is the thing itself, not a drawing of it. */}
              <div
                className="grid grid-cols-3 gap-px border border-hair bg-hair p-px"
                aria-hidden="true"
              >
                {WALL.map((photo) => (
                  <Plate key={photo.src} photo={photo} sealed className="aspect-square" />
                ))}
              </div>
              <figcaption className="marking mt-4 block text-center">
                47 photos · revealing at 11:00
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
