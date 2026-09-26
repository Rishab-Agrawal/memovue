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

/** Stills from the recording in the hero, for the PDF, where it cannot play. */
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

const VERSUS_FOLDER = [
  ["Chasing guests for uploads", "Photos arrive as they're taken"],
  ["Sign in, find the link, upload", "Scan a QR. That's it."],
  ["A folder that trickles in", "One reveal, all at once"],
];

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display-md text-center text-[clamp(1.8rem,6vw,2.5rem)] text-chalk">
      {children}
    </h2>
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
        <section className="bloom px-6 pt-14 pb-16 sm:px-10 sm:pt-20 sm:pb-24">
          <div className="mx-auto grid max-w-4xl items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16">
            <div className="text-center md:text-left">
              <h1 className="display text-[clamp(2.6rem,10vw,4.2rem)] text-chalk">
                Every guest&rsquo;s photos,{" "}
                <span className="text-flame">one album.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-sm text-[17px] leading-relaxed text-ash md:mx-0">
                A disposable camera on every guest&rsquo;s phone. Sealed until
                the reveal.
              </p>
              <PillLink href={`${SAMPLE_ALBUM.href}/join`} className="mt-8">
                Try it as a guest
              </PillLink>
            </div>

            <Phone
              src="/frames/collab-flow.mp4"
              poster="/frames/collab-join.jpg"
              className="mx-auto w-full max-w-[16rem] print:hidden"
            />
          </div>
        </section>

        <section className="border-t border-hair px-6 py-16 break-inside-avoid sm:px-10 sm:py-20">
          <Heading>How it works</Heading>
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
        </section>

        <section className="border-t border-hair px-6 py-16 break-inside-avoid sm:px-10 sm:py-20">
          <Heading>Why not just a shared folder?</Heading>
          <table className="mx-auto mt-10 w-full max-w-2xl table-fixed text-[15px] sm:text-[17px]">
            <thead>
              <tr>
                <th className="marking pb-4 text-left text-dust">
                  Shared folder
                </th>
                <th className="marking pb-4 pl-4 text-left text-flame">
                  MemoVue
                </th>
              </tr>
            </thead>
            <tbody>
              {VERSUS_FOLDER.map(([folder, memovue]) => (
                <tr key={folder} className="border-t border-hair">
                  <td className="py-5 align-top text-dust line-through decoration-hair-bright">
                    {folder}
                  </td>
                  <td className="display-sm py-5 pl-4 align-top text-chalk">
                    {memovue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bloom border-t border-hair px-6 py-16 break-inside-avoid sm:px-10 sm:py-24">
          <Heading>The collab</Heading>
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 text-center sm:grid-cols-[1fr_auto_1fr] sm:gap-8">
            <div className="border border-flame/40 px-6 py-8">
              <p className="marking text-flame">You get</p>
              <p className="display-md mt-3 text-[1.6rem] text-chalk">
                MemoVue, free
              </p>
              <p className="mt-2 text-[15px] text-ash">
                For up to {PARTICIPANT_TIERS.at(-1)} guests, set up with our
                help
              </p>
            </div>
            <span
              aria-hidden
              className="display rotate-90 self-center text-[2rem] text-flame sm:rotate-0"
            >
              &harr;
            </span>
            <div className="border border-hair-bright px-6 py-8">
              <p className="marking">You post</p>
              <p className="display-md mt-3 text-[1.6rem] text-chalk">
                1 post + 1 story
              </p>
              <p className="mt-2 text-[15px] text-ash">
                Tagging @{INSTAGRAM}. Photo, carousel or reel.
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <PillLink href={`https://ig.me/m/${INSTAGRAM}`} variant="flame">
              Send us your wedding date
            </PillLink>
            <PillLink
              href="/memovue-collab.pdf"
              download
              className="print:hidden"
            >
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
