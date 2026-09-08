"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { BackButton, Pill, PillLink } from "@/components/roll/Chrome";
import { useConfirm } from "@/components/roll/Confirm";
import { forgetDraft } from "@/app/new/DraftContext";

export const WIZARD_STEPS = 5;

/**
 * Every step of the create-roll wizard shares this frame, so it is written once.
 *
 * Progress is a rule that fills and a counter that says `03 / 05`, not five dots — dots tell
 * you there are five of something without telling you which one you are on until you count
 * them. And the way forward is a button at the thumb rather than a small pill in the
 * bottom-right corner, which is the hardest place on a phone to reach one-handed.
 *
 * Beside it, the way out. The back button in the corner steps one screen at a time, so
 * abandoning a roll from step five meant five taps at the far end of the phone from the hand
 * holding it. Cancel is the same journey in one, and it asks first — five steps of work is
 * too much to lose to a mis-tap next to the button you meant to press.
 *
 * Note there is still no Skip anywhere. The reference offers one on its date screen; skipping
 * the date would leave a roll with no window to shoot in, which is not a state worth allowing.
 */
export function WizardShell({
  step,
  title,
  subtitle,
  back,
  next,
  onNext,
  children,
}: {
  step: number;
  title: string;
  /** Optional: a step whose question is answered by the control under it needs no gloss. */
  subtitle?: string;
  back: string;
  next: { label: string; href: string; inert?: boolean };
  /** When given, the control acts instead of navigating — the last step opens a dialog. */
  onNext?: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const pad = (n: number) => String(n).padStart(2, "0");

  const cancel = () =>
    confirm({
      title: "Discard this roll?",
      body: "Nothing you’ve picked will be kept.",
      action: "Discard",
      danger: true,
      onConfirm: () => {
        // The draft outlives the page it was typed on, so leaving without clearing it would
        // seed the next roll somebody starts with the one they just abandoned.
        forgetDraft();
        router.push("/rolls");
      },
    });

  return (
    <div className="pad-safe-top flex min-h-dvh flex-col px-5 pb-[calc(var(--safe-bottom)+1.25rem)]">
      <div className="flex items-center justify-between">
        <BackButton href={back} />
        <p className="tabular text-[13px] text-dust">
          <span className="text-chalk">{pad(step)}</span> / {pad(WIZARD_STEPS)}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label={`Step ${step} of ${WIZARD_STEPS}`}
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={WIZARD_STEPS}
        className="mt-4 h-px w-full bg-hair"
      >
        <div
          className="h-px bg-flame transition-[width] duration-300 ease-[var(--ease-out-soft)]"
          style={{ width: `${(step / WIZARD_STEPS) * 100}%` }}
        />
      </div>

      <h1 className="display mt-5 text-center text-[30px] text-balance text-chalk">{title}</h1>
      {subtitle ? (
        <p className="mx-auto mt-3 max-w-[19rem] text-center text-[15px] leading-relaxed text-ash">
          {subtitle}
        </p>
      ) : null}

      {/* Top-aligned, under the question it answers. Centring it in the leftover space put a
          hand-sized hole between the title and the control, which read as the title having
          come adrift rather than as breathing room. */}
      <div className="flex-1 pt-7">{children}</div>

      {/* Equal halves. The forward action keeps the right — the side the thumb of a
          right-handed grip lands on, and the side the step counter reads towards. */}
      <div className="grid grid-cols-2 gap-3 pt-6">
        <Pill variant="quiet" full className="h-14" onClick={cancel}>
          Cancel
        </Pill>
        {onNext ? (
          <Pill variant="flame" full className="h-14" onClick={onNext} disabled={next.inert}>
            {next.label}
          </Pill>
        ) : (
          <PillLink href={next.href} variant="flame" full className="h-14" inert={next.inert}>
            {next.label}
          </PillLink>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
