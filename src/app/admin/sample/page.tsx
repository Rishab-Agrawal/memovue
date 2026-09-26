import { BackButton } from "@/components/roll/Chrome";
import { sampleSponsor } from "@/lib/referrals";
import { requireAdmin } from "@/lib/session";

import { blankSponsor } from "../SponsorFields";
import { SampleCard } from "./SampleCard";

export const metadata = { title: "Sample album card" };
export const dynamic = "force-dynamic";

/**
 * What to put on the sample album before screenshotting it for a business being pitched to.
 *
 * It is a settings screen for a page that has none, which is the point: the album has to look
 * like an album, and anything that says "you are an admin" cannot be in the frame.
 */
export default async function SampleCardPage() {
  await requireAdmin();

  const current = await sampleSponsor();

  return (
    <div className="min-h-dvh px-5 pt-4 pb-10">
      <BackButton href="/account" />

      <h1 className="display mt-5 text-[30px] text-chalk">Sample album card</h1>
      <p className="mt-2 text-[15px] text-ash">
        Put a business on the sample album, then open it and take the screenshot you send them.
        Nothing here is a real referral code, and no host ever sees it.
      </p>

      <SampleCard
        current={{
          ...blankSponsor,
          name: current?.name ?? "",
          url: current?.url ?? "",
          logoUrl: current?.logoUrl ?? "",
        }}
      />
    </div>
  );
}
