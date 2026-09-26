import type { Metadata } from "next";

import { PillLink } from "@/components/roll/Chrome";
import { Logo } from "@/components/ui/Logo";
import { Phone } from "@/components/ui/Phone";
import { PARTICIPANT_TIERS } from "@/lib/roll-config";
import { SAMPLE_ALBUM } from "@/lib/sample-album";

/*
  The brochure sent to couples who answer an Instagram pitch for a barter collab. Its PDF is a
  render of this page: rerun `node marketing/brochure.mjs` after changing it.
*/

export const metadata: Metadata = {
  title: "Wedding collab",
  description:
    "A disposable camera for your wedding, on every guest's phone. Free, for one post and one story.",
};

const INSTAGRAM = "memovue.official";

const STEPS = [
  {
    title: "Share one code",
    body: "Put the QR on the tables or in the family group. Guests scan and start shooting. No app, no sign-up.",
  },
  {
    title: "Everyone shoots",
    body: "Each guest gets a set number of shots, like a disposable camera. Every photo is sealed the moment it's taken, even from whoever took it.",
  },
  {
    title: "It all opens at once",
    body: "At the time you pick, the morning after or a week later, the whole album reveals together, each photo credited to whoever took it.",
  },
];

const VERSUS_DRIVE = [
  {
    title: "Nobody uploads later",
    body: "A Drive folder waits for guests to upload after the wedding, and most never do. Here, photos land in the album the moment they're taken.",
  },
  {
    title: "Nothing to set up for guests",
    body: "No Google sign-in, no folder link, no sharing permissions. One scan and they're shooting.",
  },
  {
    title: "A reveal, not a folder",
    body: "Drive fills up one upload at a time. MemoVue stays sealed, so guests stay in the moment, and you open everything together, like picking up prints.",
  },
];

const DEAL = [
  {
    label: "You get",
    body: `MemoVue for your wedding, free, for up to ${PARTICIPANT_TIERS.at(-1)} guests. We help you set it up.`,
  },
  {
    label: "We ask",
    body: `One feed post and one story, both tagging @${INSTAGRAM}. Photo, carousel or reel: your call.`,
  },
  {
    label: "How it goes",
    body: "Message us your wedding date. We send your code and help you set up the roll. You post after the reveal.",
  },
];

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hair px-6 py-16 break-inside-avoid sm:px-10 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="marking text-ash">{label}</p>
        <h2 className="display-md mt-4 text-[clamp(1.8rem,6vw,2.5rem)] text-chalk">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Rows({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ol className="mt-8 border-b border-hair">
      {items.map((item, index) => (
        <li
          key={item.title}
          className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-hair py-6"
        >
          <span className="marking tabular pt-1 text-flame">0{index + 1}</span>
          <div>
            <h3 className="display-sm text-[18px] text-chalk">{item.title}</h3>
            <p className="mt-2 text-[16px] leading-relaxed text-ash">
              {item.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function CollabBrochure() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-hair px-6 py-3 sm:px-10">
        <span className="flex h-11 items-center">
          <Logo />
        </span>
        <span className="marking">Wedding collab</span>
      </header>

      <main className="flex-1">
        <section className="bloom px-6 pt-14 pb-16 sm:px-10 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="display text-[clamp(2.6rem,10vw,4.5rem)] text-chalk">
              Every guest&rsquo;s photos,{" "}
              <span className="text-flame">one album.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-ash">
              A disposable camera for your wedding, on every guest&rsquo;s
              phone. Nobody sees a photo until the time you choose. Then the
              whole album opens at once.
            </p>

            {/* Sealed, then revealed. */}
            <div className="mx-auto mt-12 flex w-full max-w-[23rem] items-start">
              <Phone
                src="/frames/roll-pre-reveal.jpg"
                className="w-[58%] -rotate-6"
              />
              <Phone
                src="/frames/roll-home.jpg"
                className="mt-[16%] -ml-[16%] w-[58%] rotate-[5deg]"
              />
            </div>
          </div>
        </section>

        <Section label="How it works" title="Three steps, zero effort.">
          <Rows items={STEPS} />
        </Section>

        <Section
          label="Why not Google Drive?"
          title="Because nobody uploads after a wedding."
        >
          <Rows items={VERSUS_DRIVE} />
        </Section>

        <Section label="Try it" title="Be a guest at a sample wedding.">
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-ash">
            Open the invitation your guests would see, and take a shot. Thirty
            seconds.
          </p>
          <PillLink href={`${SAMPLE_ALBUM.href}/join`} className="mt-8">
            Open the sample
          </PillLink>
        </Section>

        <Section label="The collab" title="A simple barter.">
          <dl className="mt-8 border-b border-hair">
            {DEAL.map((term) => (
              <div
                key={term.label}
                className="grid gap-2 border-t border-hair py-6 sm:grid-cols-[9rem_1fr] sm:gap-4"
              >
                <dt className="marking pt-1 text-flame">{term.label}</dt>
                <dd className="text-[16px] leading-relaxed text-chalk">
                  {term.body}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <section className="bloom border-t border-hair px-6 py-20 break-inside-avoid sm:px-10">
          <div className="mx-auto flex max-w-3xl flex-col items-start gap-6">
            <h2 className="display text-[clamp(2.2rem,7vw,3.2rem)] text-chalk">
              The parts you <span className="text-flame">missed.</span>
            </h2>
            <p className="max-w-sm text-[16px] leading-relaxed text-ash">
              You can&rsquo;t be in every room at your own wedding. Your guests
              are.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <PillLink href={`https://ig.me/m/${INSTAGRAM}`} variant="flame">
                Message @{INSTAGRAM}
              </PillLink>
              <PillLink
                href="/memovue-collab.pdf"
                download
                className="print:hidden"
              >
                Download PDF
              </PillLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hair px-6 py-8 sm:px-10">
        <p className="marking tabular mx-auto max-w-3xl text-dust">
          memovue.com
        </p>
      </footer>
    </div>
  );
}
