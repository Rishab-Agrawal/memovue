"use client";

import { useState } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { giveawayHelp } from "@/lib/roll-config";

/**
 * The question mark beside the giveaway switch, and the sentence behind it.
 *
 * Shots giveaway is the one setting on a roll whose name says what state the switch is in
 * and nothing about what it does, and the answer is three clauses long — too much for a row
 * and exactly right for a box you open on purpose.
 *
 * The mark travels on its own rather than bundled with the switch, because the two screens
 * that carry this put them in different places: the wizard sets them side by side, and the
 * settings sheet wants the mark against the label so that every switch in that list stays on
 * one right-hand edge. What has to be shared is the sentence, which is here.
 */
export function GiveawayHelp({ shots }: { shots: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* `tap` gives it a 44px target without a 44px circle: the mark itself has to stay
          small or it competes with the switch it is annotating. */}
      <button
        type="button"
        aria-label="What is shots giveaway?"
        onClick={() => setOpen(true)}
        className="tap flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-hair-bright text-[11px] leading-none text-dust transition-colors hover:border-flame hover:text-flame"
      >
        ?
      </button>

      <Dialog
        open={open}
        title="Shots giveaway"
        onClose={() => setOpen(false)}
        actions={
          <Pill variant="quiet" full onClick={() => setOpen(false)}>
            OK
          </Pill>
        }
      >
        <p>{giveawayHelp(shots)}</p>
      </Dialog>
    </>
  );
}
