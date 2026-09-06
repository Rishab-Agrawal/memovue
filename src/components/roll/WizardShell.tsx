import type { ReactNode } from "react";

import { BackButton, Pill, PillLink } from "@/components/roll/Chrome";

export const WIZARD_STEPS = 5;

/**
 * Every step of the create-roll wizard shares this frame, so it is written once.
 *
 * Progress is a rule that fills and a counter that says `03 / 05`, not five dots — dots tell
 * you there are five of something without telling you which one you are on until you count
 * them. And the way forward is a full-width button at the thumb rather than a small pill in
 * the bottom-right corner, which is the hardest place on a phone to reach one-handed.
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
  const pad = (n: number) => String(n).padStart(2, "0");

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

      <div className="pt-6">
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
    </div>
  );
}
