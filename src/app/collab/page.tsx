import type { Metadata } from "next";

import { Brochure, INSTAGRAM, Section } from "@/components/Brochure";
import { Recording } from "@/components/ui/Recording";
import { PARTICIPANT_TIERS } from "@/lib/roll-config";

/* Sent to couples who answer an Instagram pitch for a barter collab. */

export const metadata: Metadata = {
  title: "Wedding collab",
  description:
    "A disposable camera for your wedding, on every guest's phone. Free, for one post and one story.",
};

const VERSUS_FOLDER = [
  ["Chasing guests for uploads", "Photos arrive as they're taken"],
  ["Sign in, find the link, upload", "Scan a QR. That's it."],
  ["A folder that trickles in", "One reveal, all at once"],
];

export default function CollabBrochure() {
  return (
    <Brochure
      label="Wedding collab"
      title={
        <>
          MemoVue at your wedding, <span className="text-flame">on us.</span>
        </>
      }
      lede="A disposable camera on every guest’s phone, sealed until the reveal. Yours free for one post and one story."
      media={
        <Recording
          src="/frames/collab-flow.mp4"
          poster="/frames/collab-join.jpg"
          className="mx-auto w-full max-w-[16rem] print:hidden"
        />
      }
      deal={{
        title: "The collab",
        terms: [
          {
            label: "You get",
            title: "MemoVue, free",
            body: `For up to ${PARTICIPANT_TIERS.at(-1)} guests, set up with our help`,
          },
          {
            label: "You post",
            title: "1 post + 1 story",
            body: `Tagging @${INSTAGRAM}. Photo, carousel or reel.`,
          },
        ],
        cta: "Send us your wedding date",
        pdf: "/memovue-collab.pdf",
      }}
    >
      <Section title="Why not just a shared folder?">
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
      </Section>
    </Brochure>
  );
}
