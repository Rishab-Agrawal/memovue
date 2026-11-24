"use client";

import type { CodeKind } from "@prisma/client";
import { useState } from "react";

import { Halves, ReferrerList, type ReferrerRow, type UseRow } from "./ReferrerList";

type Lists = Record<CodeKind, { unused: ReferrerRow[]; uses: UseRow[] }>;

/** One kind of code at a time. Switching drops a half-filled form, which belongs to its kind. */
export function Codes({ lists }: { lists: Lists }) {
  const [business, setBusiness] = useState(false);
  const kind: CodeKind = business ? "BUSINESS" : "INDIVIDUAL";

  return (
    <section className="mt-12">
      <Halves
        label="Kind of code"
        options={["Individuals", "Businesses"]}
        showRight={business}
        onChange={setBusiness}
      />
      <p className="mt-3 text-[14px] text-ash">
        {business
          ? "As many rolls as you allow, each naming the business on its home screen."
          : "One roll each."}
      </p>
      <ReferrerList key={kind} kind={kind} {...lists[kind]} />
    </section>
  );
}
