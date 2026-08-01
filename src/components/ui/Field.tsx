"use client";

import { type ComponentPropsWithoutRef, type ReactNode, useId } from "react";

import { cn } from "@/lib/cn";

const controlStyles =
  "w-full rounded-md bg-ink-inset border border-line px-4 text-paper " +
  "placeholder:text-paper-faint transition-colors " +
  "focus:outline-none focus:border-ember focus:ring-1 focus:ring-ember " +
  "disabled:opacity-50 aria-[invalid=true]:border-danger";

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
      <label htmlFor={id} className="text-[13px] font-medium tracking-wide text-paper-dim">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-snug text-paper-faint">{hint}</p>
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
          className={cn(controlStyles, "h-12", className)}
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
          className={cn(controlStyles, "min-h-24 resize-y py-3 leading-relaxed", className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

/** Segmented chip picker — faster than a native select on a phone, and it shows all options. */
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
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium tracking-wide text-paper-dim">{label}</span>
      <div className={cn("grid gap-2", columns ?? "grid-cols-3")} role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md",
                "border px-2 py-2 text-[14px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                selected
                  ? "border-ember bg-ember/12 text-paper"
                  : "border-line bg-ink-inset text-paper-dim hover:border-line-bright hover:text-paper",
              )}
            >
              <span className={cn(selected && "font-medium")}>{option.label}</span>
              {option.sublabel ? (
                <span className="text-[11px] text-paper-faint">{option.sublabel}</span>
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
        <p className="text-[13px] leading-snug text-paper-faint">{hint}</p>
      ) : null}
    </div>
  );
}

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
        "flex w-full items-start gap-3 rounded-md border border-line bg-ink-inset p-4 text-left",
        "transition-colors hover:border-line-bright",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-ember" : "bg-line-bright",
        )}
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full bg-paper transition-transform duration-200",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] text-paper">{label}</span>
        {description ? (
          <span className="text-[13px] leading-snug text-paper-faint">{description}</span>
        ) : null}
      </span>
    </button>
  );
}
