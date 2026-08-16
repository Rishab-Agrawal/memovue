import type { ReactNode } from "react";

import { BackButton, PagerDots, Pill, PillLink } from "./Chrome";

export const WIZARD_STEPS = 6;

/**
 * Every step of the create-film wizard shares this frame, so it is written once: back
 * button, centred title and subtitle, the step's own content, then the pager and the next
 * control.
 *
 * Note there is no Skip anywhere. The reference offers one on its date screen; skipping the
 * date would leave a film with no window to shoot in, which is not a state worth allowing.
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
  subtitle: string;
  back: string;
  next: { label: string; href: string; inert?: boolean };
  /** When given, the control acts instead of navigating — the last step opens a dialog. */
  onNext?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col px-5 pt-4 pb-5">
      <BackButton href={back} />

      <h1 className="display mt-5 text-center text-[30px] text-balance text-chalk">{title}</h1>
      <p className="mx-auto mt-3 max-w-[19rem] text-center text-[15px] leading-relaxed text-ash">
        {subtitle}
      </p>

      <div className="flex-1 pt-7">{children}</div>

      {/* The dots are centred on the screen, not on the space the button leaves — which is
          how the reference has them, and the only version that doesn't look nudged. */}
      <div className="relative flex h-12 items-center justify-end pt-6 pb-0">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
          <PagerDots count={WIZARD_STEPS} current={step} />
        </div>
        {onNext ? (
          <Pill variant="light" onClick={onNext} disabled={next.inert} className="relative">
            {next.label}
          </Pill>
        ) : (
          <PillLink href={next.href} variant="light" inert={next.inert} className="relative">
            {next.label}
          </PillLink>
        )}
      </div>
    </div>
  );
}
