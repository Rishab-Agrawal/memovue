"use client";

import { useState, type ComponentProps } from "react";

import { BetaGate } from "@/components/roll/BetaGate";
import { Pill, PillLink } from "@/components/roll/Chrome";

/**
 * The way into the wizard, and the wall in front of it.
 *
 * The check happens here rather than at the end of the six steps because being told you are
 * not allowed after picking a date, a reveal rule and a cover is the worst possible moment to
 * hear it. The wizard's last step still handles a refusal — an allowance can run out while
 * somebody is halfway through it, and the server is the only thing that decides — but nobody
 * should reach that dialog by walking the whole wizard first.
 */
export function NewRollButton({
  canCreate,
  hostName,
  children,
  ...pill
}: {
  canCreate: boolean;
  hostName: string;
} & Pick<ComponentProps<typeof Pill>, "variant" | "className" | "children">) {
  const [blocked, setBlocked] = useState(false);

  if (canCreate) {
    return (
      <PillLink href="/new/name" {...pill}>
        {children}
      </PillLink>
    );
  }

  return (
    <>
      <Pill {...pill} onClick={() => setBlocked(true)}>
        {children}
      </Pill>
      <BetaGate open={blocked} onClose={() => setBlocked(false)} hostName={hostName} />
    </>
  );
}
