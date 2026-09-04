"use client";

import { cn } from "@/lib/cn";

import { Clock, Hourglass } from "@/components/roll/Icons";
import { Plate } from "@/components/roll/Plate";
import { WizardShell } from "@/components/roll/WizardShell";
import { formatShortDateTime } from "@/lib/format";
import { FRAMES } from "@/lib/imagery";
import { computeRevealAt } from "@/lib/roll-access";
import { MAX_DELAY_HOURS, MIN_DELAY_HOURS } from "@/lib/roll-config";
import type { RevealMode } from "./../DraftContext";
import { useDraft } from "../DraftContext";

const MODES: { mode: RevealMode; label: string }[] = [
  { mode: "DURING", label: "During\nEvent" },
  { mode: "AFTER", label: "After\nEvent" },
  { mode: "DELAY", label: "Additional\nDelay" },
];


/**
 * The one screen that has to demonstrate rather than describe: the two sample frames go
 * sharp or sealed as the mode changes, so a host can see what their guests will be looking
 * at before committing to it.
 */
export default function StepReveal() {
  const { draft, update } = useDraft();

  // Null for DURING, which is what makes the frames render sharp and hides the chip.
  // computeRevealAt still returns a date for that mode — the column is never null — so the
  // check has to be on the mode, not on the result.
  const reveals =
    draft.revealMode === "DURING"
      ? null
      : computeRevealAt(draft.finishesAt, draft.revealMode, draft.delayHours);

  return (
    <WizardShell
      step={4}
      title="When should we reveal your photos?"
      subtitle="Photos are hidden by default during the event. You can select when the photos will be revealed."
      back="/new/finish"
      next={{ label: "Next →", href: "/new/card" }}
    >
      <div className="relative">
        <div className="grid grid-cols-2 gap-3">
          {[
            { photo: FRAMES[0], by: "Meera" },
            { photo: FRAMES[1], by: "Arjun" },
          ].map((sample) => (
            <div key={sample.by} className="relative h-[220px] overflow-hidden rounded-3xl">
              <Plate photo={sample.photo} className="absolute inset-0" sealed={Boolean(reveals)} />
              <span className="absolute top-3 left-3 text-[14px] text-chalk/80 italic">
                {sample.by}
              </span>
            </div>
          ))}
        </div>

        {reveals ? (
          <span className="tabular absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-void/75 px-4 py-2 text-[14px] whitespace-nowrap text-chalk backdrop-blur-sm">
            <Clock className="h-4 w-4" />
            Reveals on {formatShortDateTime(reveals)}
          </span>
        ) : null}
      </div>

      <div className="mt-7 grid grid-cols-3 gap-3">
        {MODES.map(({ mode, label }) => {
          const active = draft.revealMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              onClick={() => update({ revealMode: mode })}
              className={cn(
                "flex flex-col items-start gap-3 rounded-2xl p-4 text-left text-[15px] leading-tight transition-colors",
                active
                  ? "border border-flame bg-flame/10 text-flame"
                  : "bg-surface text-chalk hover:text-flame",
              )}
            >
              <Hourglass className="h-5 w-5" />
              <span className="whitespace-pre-line">{label}</span>
            </button>
          );
        })}
      </div>

      {draft.revealMode === "DELAY" ? (
        <div className="mt-6 flex items-center justify-center gap-5 border-t border-hair pt-6">
          <Stepper
            label="Decrease delay"
            glyph="−"
            disabled={draft.delayHours <= MIN_DELAY_HOURS}
            onClick={() => update({ delayHours: draft.delayHours - 1 })}
          />
          <p className="tabular w-16 text-center text-[22px] text-chalk" data-testid="delay-hours">
            {draft.delayHours}
          </p>
          <Stepper
            label="Increase delay"
            glyph="+"
            disabled={draft.delayHours >= MAX_DELAY_HOURS}
            onClick={() => update({ delayHours: draft.delayHours + 1 })}
          />
          <span className="sr-only">hours after the roll closes</span>
        </div>
      ) : null}
    </WizardShell>
  );
}

function Stepper({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-14 items-center justify-center rounded-2xl bg-surface text-[20px] text-chalk transition-colors hover:text-flame disabled:opacity-30 disabled:hover:text-chalk"
    >
      {glyph}
    </button>
  );
}
