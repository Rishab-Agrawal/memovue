"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Trash } from "@/components/roll/Icons";
import { SponsorCard } from "@/components/roll/Sponsor";

import { addReferrerAction, removeReferrerAction } from "../actions";

interface ReferrerRow {
  id: string;
  code: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  /** How many rolls this code has created. The whole point of the programme, counted. */
  rolls: number;
}

const blank = { code: "", name: "", url: "", logoUrl: "" };

/**
 * Minting a code, and the list of the ones that exist.
 *
 * The form previews the card as it is typed, using the same component the roll screen renders.
 * A logo is a URL on somebody else's server, so the only way to know whether it loads — and
 * whether it survives being dropped into a 48px square — is to look at it before saving.
 *
 * Removing asks first: the bin sits next to a row whose rolls are already out in the world, and
 * every one of them silently loses its credit.
 */
export function ReferrerList({ rows }: { rows: ReferrerRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ReferrerRow | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<typeof blank>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const add = () => {
    setError(null);
    startTransition(async () => {
      const result = await addReferrerAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm(blank);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await removeReferrerAction({ id });
      setRemoving(null);
      router.refresh();
    });
  };

  const ready = form.code.trim() !== "" && form.name.trim() !== "";

  return (
    <>
      <div className="mt-8 space-y-4 rounded-2xl bg-surface p-5">
        <Field
          label="Code"
          value={form.code}
          onChange={(code) => set({ code })}
          placeholder="BLOOM24"
          className="tracking-[0.08em] uppercase"
        />
        <Field
          label="Business name"
          value={form.name}
          onChange={(name) => set({ name })}
          placeholder="Bloom Events"
        />
        <Field
          label="Website (optional)"
          value={form.url}
          onChange={(url) => set({ url })}
          placeholder="https://bloomevents.in"
        />
        <Field
          label="Logo URL (optional)"
          value={form.logoUrl}
          onChange={(logoUrl) => set({ logoUrl })}
          placeholder="https://bloomevents.in/logo.png"
        />

        {/* Exactly what a guest will see, drawn by the component that draws it there. */}
        {form.name.trim() ? (
          <div>
            <p className="marking">Preview</p>
            <div className="mt-2 rounded-2xl bg-void p-3">
              <SponsorCard
                name={form.name.trim()}
                url={form.url.trim() || null}
                logoUrl={form.logoUrl.trim() || null}
              />
            </div>
          </div>
        ) : null}

        <Pill variant="flame" full disabled={pending || !ready} onClick={add}>
          {pending ? "Saving…" : "Create this code"}
        </Pill>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>

      <section className="mt-10">
        <p className="marking">Codes · {rows.length}</p>

        {rows.length === 0 ? (
          <p className="mt-3 text-[14px] text-dust">No business is sending anybody here yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hair border-t border-hair">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-chalk">{row.name}</p>
                  <p className="mt-0.5 text-[13px] text-dust">
                    <span className="tracking-[0.08em] text-ash">{row.code}</span>
                    {" · "}
                    {row.rolls} roll{row.rolls === 1 ? "" : "s"}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label={`Remove ${row.name}`}
                  disabled={pending}
                  onClick={() => setRemoving(row)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-dust transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={removing !== null}
        title="Retire this code?"
        actions={
          <>
            <Pill variant="quiet" full disabled={pending} onClick={() => setRemoving(null)}>
              Cancel
            </Pill>
            <Pill
              full
              disabled={pending}
              className="bg-danger text-void hover:bg-danger"
              onClick={() => removing && remove(removing.id)}
            >
              {pending ? "Removing…" : "Retire"}
            </Pill>
          </>
        }
      >
        <p>{removing?.name}</p>
        <p className="mt-2">
          Nobody can type {removing?.code} again, and the {removing?.rolls} roll
          {removing?.rolls === 1 ? "" : "s"} it created stop naming them. The rolls themselves are
          untouched.
        </p>
      </Dialog>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className="block">
      <span className="marking">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={label}
        className={`mt-2 h-12 w-full rounded-2xl bg-void px-4 text-[15px] text-chalk placeholder:text-dust placeholder:normal-case placeholder:tracking-normal focus:outline-none focus-visible:ring-1 focus-visible:ring-flame ${className ?? ""}`}
      />
    </label>
  );
}
