"use client";

import { type ComponentPropsWithoutRef, type ReactNode, useId } from "react";

import { cn } from "@/lib/cn";

/**
 * Underline inputs, not boxes.
 *
 * A boxed input with a rounded border and a grey fill is the default shadcn/Tailwind
 * shape, and it makes every form on the web look like the same form. These are ruled
 * lines you write on — closer to a printed booking slip — with the rule burning orange on
 * focus. Field labels are set in the tracked "marking" style, like camera-body engraving.
 *
 * Two things about that were costing more than they bought, and are fixed here.
 *
 * The label used to float eight pixels clear of a 48px-tall control that had no fill, no
 * placeholder and a rule the same weight as a section divider — so an untouched signup form
 * read as a heading, a void, and a line, three times over, with nothing saying "type here".
 * The label now sits tight against its control, the resting rule is brighter than any
 * divider on the page, and every field carries a placeholder. Proximity does the grouping;
 * the rule does the affordance. Still no box.
 *
 * Hints and errors were also visually attached and programmatically invisible — a screen
 * reader got "Password" and nothing about the eight-character rule. Both are wired through
 * `aria-describedby` now.
 */

const controlStyles =
  "w-full bg-transparent border-0 border-b px-0 text-chalk " +
  "placeholder:text-dust outline-none " +
  "transition-[border-color,box-shadow] duration-200 " +
  // Brighter at rest than `hair`, so a control never reads as a divider. On focus the rule
  // burns orange and doubles, drawn with a shadow so nothing reflows.
  "border-hair-bright hover:border-ash " +
  "focus:border-flame focus:shadow-[0_1px_0_0_var(--color-flame)] " +
  "disabled:opacity-50 " +
  "aria-[invalid=true]:border-danger " +
  "aria-[invalid=true]:focus:shadow-[0_1px_0_0_var(--color-danger)]";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}

function FieldShell({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const hasNote = Boolean(error ?? hint);

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="marking mb-1.5">
        {label}
      </label>

      {children(id, hasNote ? noteId : undefined)}

      {error ? (
        <p id={noteId} className="mt-2.5 text-[13px] leading-snug text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="mt-2.5 text-[13px] leading-snug text-ash">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: { label: string; hint?: ReactNode; error?: string } & ComponentPropsWithoutRef<"input">) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlStyles, "h-11 text-[17px]", className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  ...props
}: { label: string; hint?: ReactNode; error?: string } & ComponentPropsWithoutRef<"textarea">) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {(id, describedBy) => (
        <textarea
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            controlStyles,
            "min-h-20 resize-y py-2 text-[16px] leading-relaxed",
            className,
          )}
          {...props}
        />
      )}
    </FieldShell>
  );
}

/**
 * A typographic option list rather than a grid of pill chips.
 *
 * Cells are separated by shared hairlines — like an index or a spec sheet — and selection
 * is shown by the label burning orange with a rule under it, not by a filled rounded
 * rectangle. No icons: the words are the interface.
 */
export function ChipGroup<T extends string | number>({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  columns,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  options: { value: T; label: string; sublabel?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: string;
}) {
  const noteId = useId();
  const hasNote = Boolean(error ?? hint);

  return (
    <div className="flex flex-col">
      <span className="marking mb-2">{label}</span>

      {/* Each cell draws its own right and bottom edge; the container closes the top, left
          and right so a partial final row doesn't leave the grid hanging open. */}
      <div
        className={cn("grid border-t border-r border-l border-hair", columns ?? "grid-cols-3")}
        role="group"
        aria-label={label}
        aria-describedby={hasNote ? noteId : undefined}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex min-h-[52px] flex-col items-start justify-center gap-0.5",
                "border-r border-b border-hair px-3 py-2.5 text-left text-[15px]",
                "transition-colors duration-150 focus-visible:outline focus-visible:outline-2",
                "focus-visible:-outline-offset-2 focus-visible:outline-flame",
                selected ? "text-flame" : "text-ash hover:text-chalk",
              )}
            >
              <span className={cn(selected && "font-medium")}>{option.label}</span>
              {option.sublabel ? (
                <span className="text-[12px] text-dust">{option.sublabel}</span>
              ) : null}
              {/* Two pixels, not one. Across a seven-column row of bare numbers the
                  hairline was doing the entire job of saying which one you picked. */}
              {selected ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-flame" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <p id={noteId} className="mt-2.5 text-[13px] leading-snug text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="mt-2.5 text-[13px] leading-snug text-ash">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A square marker that fills orange, rather than the iOS sliding pill — which is the other
 * component that makes every settings screen look identical.
 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex w-full items-start gap-3.5 border-t border-hair py-4 text-left",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-flame",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-[20px] w-[20px] shrink-0 place-items-center border transition-colors",
          checked ? "border-flame bg-flame" : "border-hair-bright group-hover:border-ash",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-void" aria-hidden="true">
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[15px] text-chalk">{label}</span>
        {description ? (
          <span className="text-[13px] leading-snug text-ash">{description}</span>
        ) : null}
      </span>
    </button>
  );
}
