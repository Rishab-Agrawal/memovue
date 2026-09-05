"use client";

import { DatePick } from "@/components/roll/DatePick";
import { WizardShell } from "@/components/roll/WizardShell";
import type { DateRange } from "@/lib/roll-config";

/**
 * Start and finish are the same screen with different copy and a different clamp, so they
 * share one component rather than diverging the moment either is edited.
 *
 * The control itself is `DatePick`, which the settings sheet also uses to move a roll's
 * closing time after the fact. What is left here is the wizard around it.
 */
export function DateStep({
  step,
  title,
  subtitle,
  back,
  nextHref,
  value,
  onChange,
  range,
  notBefore,
}: {
  step: number;
  title: string;
  subtitle: string;
  back: string;
  nextHref: string;
  value: Date;
  onChange: (next: Date) => void;
  range: DateRange;
  /** The earliest instant this screen may return. The finish has one; the start does not. */
  notBefore?: Date;
}) {
  return (
    <WizardShell
      step={step}
      title={title}
      subtitle={subtitle}
      back={back}
      next={{ label: "Next →", href: nextHref }}
    >
      <DatePick value={value} onChange={onChange} range={range} notBefore={notBefore} />
    </WizardShell>
  );
}
