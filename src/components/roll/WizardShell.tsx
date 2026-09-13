"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { BackButton, Pill, PillLink } from "@/components/roll/Chrome";
import { useConfirm } from "@/components/roll/Confirm";
import { forgetDraft } from "@/app/new/DraftContext";

const WIZARD_STEPS = 5;

/**
 * The frame every wizard step shares: a progress rule and `03 / 05` counter, then Cancel (which
 * confirms and discards the draft) and Next at the bottom, within thumb reach.
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
        // The draft is persisted, so it must be cleared or it seeds the next roll.
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

      <div className="flex-1 pt-7">{children}</div>

      {/* Equal halves, forward on the right. */}
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
