"use client";

import { PillLink } from "@/components/roll/Chrome";
import { Download } from "@/components/roll/Icons";
import { savePngToPhotos } from "@/lib/share";

/** A download everywhere it lands somewhere useful; the share sheet on iOS, where it does not. */
export function SaveQr({ qr, code }: { qr: string; code: string }) {
  const name = `memovue-${code}.png`;

  return (
    <PillLink
      href={qr}
      download={name}
      onClick={(event) => {
        if (savePngToPhotos(qr, name)) event.preventDefault();
      }}
      variant="quiet"
      full
      className="px-3 text-[14px]"
    >
      <Download className="h-4 w-4" />
      Save QR
    </PillLink>
  );
}
