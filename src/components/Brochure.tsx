import { PillLink } from "@/components/roll/Chrome";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { SAMPLE_ALBUM } from "@/lib/sample-album";

/*
  A pitch sent as one link: a hero, how MemoVue works, the page's own sections, then the deal.
  Each brochure's PDF is a render of its page: rerun `node marketing/brochure.mjs` after
  changing one.
*/

export const INSTAGRAM = "memovue.official";

/** Stills from the screen recording, so the PDF, which cannot play it, still shows the flow. */
const STEPS = [
  {
    title: "Scan",
    body: "One QR. No app, no sign-up.",
    shot: "/frames/collab-join.jpg",
  },
  {
    title: "Shoot",
    body: "Every photo sealed, even from its taker.",
    shot: "/frames/collab-shoot.jpg",
  },
  {
    title: "Reveal",
    body: "The whole album opens at once.",
    shot: "/frames/collab-album.jpg",
  },
];

interface Term {
  label: string;
  title: string;
  body: string;
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hair px-6 py-16 break-inside-avoid sm:px-10 sm:py-20">
      <h2 className="display-md text-center text-[clamp(1.8rem,6vw,2.5rem)] text-chalk">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Offer({ term, lit }: { term: Term; lit?: boolean }) {
  return (
    <div
      className={cn(
        "border px-6 py-8",
        lit ? "border-flame/40" : "border-hair-bright",
      )}
    >
      <p className={cn("marking", lit && "text-flame")}>{term.label}</p>
      <p className="display-md mt-3 text-[1.6rem] text-chalk">{term.title}</p>
      <p className="mt-2 text-[15px] text-ash">{term.body}</p>
    </div>
  );
}

export function Brochure({
  label,
  title,
  lede,
  media,
  deal,
  children,
}: {
  /** Names the brochure in the header, so it never reads as the home page. */
  label: string;
  title: React.ReactNode;
  lede: string;
  media: React.ReactNode;
  /** The first term is the reader's side, and is the one lit. */
  deal: { title: string; terms: [Term, Term]; cta: string; pdf: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-hair px-6 py-3 sm:px-10">
        <span className="flex h-11 items-center">
          <Logo />
        </span>
        <span className="marking">{label}</span>
      </header>

      <main className="flex-1">
        <section className="bloom px-6 pt-14 pb-16 sm:px-10 sm:pt-20 sm:pb-24">
          <div className="mx-auto grid max-w-4xl items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16">
            <div className="text-center md:text-left">
              <h1 className="display text-[clamp(2.6rem,10vw,4.2rem)] text-chalk">
                {title}
              </h1>
              <p className="mx-auto mt-6 max-w-sm text-[17px] leading-relaxed text-ash md:mx-0">
                {lede}
              </p>
              <PillLink href={`${SAMPLE_ALBUM.href}/join`} className="mt-8">
                Try it as a guest
              </PillLink>
            </div>
            {media}
          </div>
        </section>

        <Section title="How it works">
          <ol className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 sm:gap-8">
            {STEPS.map((step, index) => (
              <li key={step.title} className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.shot}
                  alt=""
                  className="w-full rounded-2xl border border-hair-bright sm:rounded-3xl"
                />
                <p className="marking tabular mt-4 text-flame">0{index + 1}</p>
                <h3 className="display-sm mt-1 text-[17px] text-chalk sm:text-[20px]">
                  {step.title}
                </h3>
                <p className="mt-1 text-[13px] leading-snug text-ash sm:text-[15px]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        {children}

        <section className="bloom border-t border-hair px-6 py-16 break-inside-avoid sm:px-10 sm:py-24">
          <h2 className="display-md text-center text-[clamp(1.8rem,6vw,2.5rem)] text-chalk">
            {deal.title}
          </h2>
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 text-center sm:grid-cols-[1fr_auto_1fr] sm:gap-8">
            <Offer term={deal.terms[0]} lit />
            <span
              aria-hidden
              className="display rotate-90 self-center text-[2rem] text-flame sm:rotate-0"
            >
              &harr;
            </span>
            <Offer term={deal.terms[1]} />
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <PillLink href={`https://ig.me/m/${INSTAGRAM}`} variant="flame">
              {deal.cta}
            </PillLink>
            <PillLink href={deal.pdf} download className="print:hidden">
              Download PDF
            </PillLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-hair px-6 py-8 sm:px-10">
        <p className="marking mx-auto max-w-3xl text-center text-dust">
          memovue.com
        </p>
      </footer>
    </div>
  );
}
