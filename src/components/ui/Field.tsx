"use client";

import { type ComponentPropsWithoutRef, type ReactNode, useId } from "react";

import { cn } from "@/lib/cn";

/**
 * Underline inputs, not boxes.
 *
 * A boxed input with a rounded border and a grey fill is the default shadcn/Tailwind
 * shape, and it makes every form on the web look like the same form. These are ruled
 * lines you write on — closer to a printed booking slip — with the rule burning orange on
 * focus. Field labels are set in the mono "marking" style, like camera-body engraving.
 */

const controlStyles =
  "w-full bg-transparent border-0 border-b border-hair-bright px-0 text-chalk " +
  "placeholder:text-dust transition-colors outline-none " +
  "focus:border-flame disabled:opacity-50 aria-[invalid=true]:border-danger";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string) => ReactNode;
}

function FieldShell({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="marking">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-snug text-dust">{hint}</p>
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
      {(id) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(controlStyles, "h-12 text-[17px]", className)}
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
      {(id) => (
        <textarea
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(controlStyles, "min-h-20 resize-y py-2 text-[16px] leading-relaxed", className)}
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
  return (
    <div className="flex flex-col gap-2.5">
      <span className="marking">{label}</span>

      {/* Each cell draws its own right and bottom edge; the container closes the top, left
          and right so a partial final row doesn't leave the grid hanging open. */}
      <div
        className={cn("grid border-t border-r border-l border-hair", columns ?? "grid-cols-3")}
        role="group"
        aria-label={label}
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
                "transition-colors focus-visible:outline focus-visible:outline-1",
                "focus-visible:-outline-offset-1 focus-visible:outline-flame",
                selected ? "text-flame" : "text-ash hover:text-chalk",
              )}
            >
              <span className={cn(selected && "font-medium")}>{option.label}</span>
              {option.sublabel ? (
                <span className="text-[11px] text-dust">{option.sublabel}</span>
              ) : null}
              {selected ? (
                <span className="absolute inset-x-0 bottom-0 h-px bg-flame" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-snug text-dust">{hint}</p>
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
        "group flex w-full items-start gap-3.5 border-t border-hair pt-4 text-left",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2",
        "focus-visible:outline-flame",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center border transition-colors",
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
          <span className="text-[13px] leading-snug text-dust">{description}</span>
        ) : null}
      </span>
    </button>
  );
}
