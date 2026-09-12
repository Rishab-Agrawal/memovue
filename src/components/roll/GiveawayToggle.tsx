"use client";

import { useState } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Toggle } from "@/components/roll/Toggle";
import { GIVEAWAY_LABEL, giveawayHelp, giveawayLabel } from "@/lib/roll-config";

/**
 * The host's switch for giving shots away, with the sentence that explains it attached.
 *
 * Attached, rather than left as a subtitle under the row: this is the one setting on a roll
 * whose name does not say what it does. "No shots giveaway" tells a host what state the
 * switch is in and nothing about what they are turning on, and the answer is three clauses
 * long — too much for a row and exactly right for a box you open on purpose.
 *
 * One component for the wizard and the settings sheet, because the sentence has to be the
 * same sentence, and a screen that had its own copy of it would be the screen that went stale.
 */
export function GiveawayToggle({
  on,
  shots,
  onChange,
  bare,
}: {
  on: boolean;
  /** The roll's shots per guest — half of it is the number the sentence quotes. */
  shots: number;
  onChange: (next: boolean) => void;
  /** For the settings row, which carries the label itself and wants only the switch. */
  bare?: boolean;
}) {
  const [helping, setHelping] = useState(false);
  const label = giveawayLabel(on);

  return (
    <>
      <span className="flex items-center gap-3">
        {bare ? (
          <Toggle on={on} onChange={onChange} name={label} />
        ) : (
          <Toggle
            on={on}
            onChange={onChange}
            labelOn={GIVEAWAY_LABEL.on}
            labelOff={GIVEAWAY_LABEL.off}
          />
        )}

        {/* `tap` gives it a 44px target without a 44px circle: the mark itself has to stay
            small or it competes with the switch it is annotating. */}
        <button
          type="button"
          aria-label="What is shots giveaway?"
          onClick={() => setHelping(true)}
          className="tap flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-hair-bright text-[11px] leading-none text-dust transition-colors hover:border-flame hover:text-flame"
        >
          ?
        </button>
      </span>

      <Dialog
        open={helping}
        title="Shots giveaway"
        onClose={() => setHelping(false)}
        actions={
          <Pill variant="quiet" full onClick={() => setHelping(false)}>
            OK
          </Pill>
        }
      >
        <p>{giveawayHelp(shots)}</p>
      </Dialog>
    </>
  );
}
