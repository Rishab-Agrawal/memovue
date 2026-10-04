import type { Metadata } from "next";

import { Brochure, Section } from "@/components/Brochure";
import { Phone } from "@/components/ui/Phone";
import { PARTICIPANT_TIERS } from "@/lib/roll-config";

/* Sent to businesses whose clients get MemoVue free with the business's referral code. */

export const metadata: Metadata = {
  title: "Partner with MemoVue",
  description:
    "Give your clients MemoVue free with your code. Their wedding album credits you to every guest.",
};

const REACH = [
  {
    title: "Every guest",
    body: "Your card sits on the album's home screen, where every guest lands.",
  },
  {
    title: "Every visit",
    body: "Guests come back all event long, and again at the reveal.",
  },
  { title: "One tap", body: "Your name links straight to your site." },
];

export default function PartnerBrochure() {
  return (
    <Brochure
      label="Partnership"
      title={
        <>
          Your brand in every{" "}
          <span className="text-flame">guest&rsquo;s hands.</span>
        </>
      }
      lede="Give your clients MemoVue free with your code. Their wedding album credits you to every guest."
      media={
        <Phone
          src="/frames/partner-roll-home.jpg"
          width={720}
          height={1384}
          className="mx-auto w-full max-w-[16rem]"
        />
      }
      deal={{
        title: "The partnership",
        terms: [
          {
            label: "You get",
            title: "Your brand on their album",
            body: "Logo, name and link, in front of every guest",
          },
          {
            label: "Your clients get",
            title: "MemoVue, free",
            body: `With your code, for up to ${PARTICIPANT_TIERS.at(-1)} guests`,
          },
        ],
        cta: "Get your code",
        pdf: "/memovue-partners.pdf",
      }}
    >
      <Section title="Where your brand appears">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/frames/partner-card.jpg"
          alt="A card on the album reading: Brought to you by Your Brand, yourbrand.com"
          // The card's own 16px corners, as a share of the crop so they scale with it.
          className="mx-auto mt-10 w-full max-w-md rounded-[4.65%/17.6%]"
        />
        <ul className="mx-auto mt-12 grid max-w-3xl gap-8 text-center sm:grid-cols-3">
          {REACH.map((point) => (
            <li key={point.title}>
              <p className="display-md text-[1.6rem] text-flame">
                {point.title}
              </p>
              <p className="mx-auto mt-2 max-w-[16rem] text-[15px] leading-snug text-ash">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </Brochure>
  );
}
