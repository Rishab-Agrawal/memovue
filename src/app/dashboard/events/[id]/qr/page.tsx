import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { joinUrl, qrSvg } from "@/lib/qr";
import { requireHost } from "@/lib/session";

import { PrintButton } from "./PrintButton";

export const metadata = { title: "Printable code" };

/**
 * A card designed to be printed and left on tables, so it deliberately ignores the app's
 * dark theme — printing a near-black page wastes a cartridge and scans badly.
 */
export default async function PrintableQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHost();

  const event = await prisma.event.findFirst({
    where: { id, hostId: user.id },
    select: { code: true, name: true, photosPerGuest: true },
  });
  if (!event) notFound();

  const qr = await qrSvg(event.code, { dark: "#111111", light: "#ffffff" });

  return (
    <div className="min-h-dvh bg-white px-6 py-10 text-[#111] print:p-0">
      <div className="mx-auto flex max-w-[30rem] flex-col items-center text-center">
        <p className="text-[13px] font-medium tracking-[0.22em] text-[#b4441f] uppercase">
          Scan to join
        </p>
        <h1
          className="mt-3 text-[2.4rem] leading-tight font-normal"
          style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontWeight: 700 }}
        >
          {event.name}
        </h1>

        <div
          className="mt-7 w-full max-w-[19rem] [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />

        <p className="mt-6 text-[15px] leading-relaxed text-[#444]">
          Point your phone camera at the code. You get{" "}
          <strong className="text-[#111]">{event.photosPerGuest} photos</strong>, and the whole
          album opens after the event.
        </p>

        <div className="mt-6 border-t border-[#ddd] pt-5 text-[14px] text-[#666]">
          <p>Can&rsquo;t scan? Go to</p>
          <p className="mt-1 text-[16px] text-[#111]">{joinUrl(event.code).replace(/^https?:\/\//, "")}</p>
        </div>

        <PrintButton />
      </div>
    </div>
  );
}
