"use client";

import type { CodeKind } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Pencil, Trash } from "@/components/roll/Icons";

import {
  Field,
  SponsorFields,
  type SponsorDraft,
  appendSponsor,
  blankSponsor,
  forgetLogoPreview,
} from "../SponsorFields";
import { removeReferrerAction, saveReferrerAction } from "../actions";

export interface ReferrerRow {
  id: string;
  code: string;
  name: string;
  url: string | null;
  email: string | null;
  logoUrl: string | null;
  maxUses: number;
  used: number;
}

interface Draft extends SponsorDraft {
  id: string;
  code: string;
  email: string;
  maxUses: string;
}

const blank: Draft = { ...blankSponsor, id: "", code: "", email: "", maxUses: "10" };

function toDraft(row: ReferrerRow): Draft {
  return {
    ...blankSponsor,
    id: row.id,
    code: row.code,
    email: row.email ?? "",
    maxUses: String(row.maxUses),
    name: row.name,
    url: row.url ?? "",
    logoUrl: row.logoUrl ?? "",
  };
}

/**
 * One kind of code: the form that mints it, and the list.
 *
 * An individual's code is a name and a code, spent by one roll and never edited — a mistake is
 * retired and minted again. A business's is editable after the fact, the code included: a
 * business renames itself, moves domain, or was typed in wrong on a Tuesday, and none of that is
 * a reason to retire a code that is already printed on somebody's cards. Rolls point at the row,
 * not at the string.
 *
 * The business form puts the fields only we ever see first, then the three a guest does, then
 * the card they make. Ordering the form by audience is the only ordering that survives a new
 * field.
 */
export function ReferrerList({ kind, rows }: { kind: CodeKind; rows: ReferrerRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ReferrerRow | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);

  const business = kind === "BUSINESS";
  const editing = draft.id !== "";

  const set = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  /** Revokes whatever preview it displaces; the updater itself must stay pure. */
  const reset = (next: Draft) => {
    forgetLogoPreview(draft);
    setDraft(next);
    setError(null);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("id", draft.id);
      form.set("kind", kind);
      form.set("code", draft.code);
      if (business) {
        form.set("maxUses", draft.maxUses);
        form.set("email", draft.email);
        appendSponsor(form, draft);
      } else {
        form.set("name", draft.name);
      }

      const result = await saveReferrerAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset(blank);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await removeReferrerAction({ id });
      setRemoving(null);
      if (draft.id === id) reset(blank);
      router.refresh();
    });
  };

  // An individual's code may be left blank, and one is picked for it.
  const ready = draft.name.trim() !== "" && (!business || draft.code.trim() !== "");

  return (
    <>
      <div ref={formRef} className="mt-4 scroll-mt-4 space-y-4 rounded-2xl bg-surface p-5">
        <p className="marking">{editing ? `Editing ${draft.code}` : "New code"}</p>

        {business ? (
          <>
            <Field
              label="Code"
              value={draft.code}
              onChange={(code) => set({ code })}
              placeholder="BLOOM24"
              className="tracking-[0.08em] uppercase"
            />
            <Field
              label="Rolls allowed"
              value={draft.maxUses}
              onChange={(maxUses) => set({ maxUses })}
              placeholder="10"
            />
            <Field
              label="Email for new rolls (optional)"
              value={draft.email}
              onChange={(email) => set({ email })}
              placeholder="hello@bloomevents.in"
            />

            <SponsorFields
              value={draft}
              onChange={set}
              busy={busy}
              onBusy={setBusy}
              onError={setError}
            />
          </>
        ) : (
          <>
            <Field
              label="For"
              value={draft.name}
              onChange={(name) => set({ name })}
              placeholder="Priya Sharma"
            />
            <Field
              label="Code (optional)"
              value={draft.code}
              onChange={(code) => set({ code })}
              placeholder="Left blank, one is picked"
              className="tracking-[0.08em] uppercase"
            />
          </>
        )}

        <div className={editing ? "grid grid-cols-2 gap-3" : ""}>
          {editing ? (
            <Pill variant="quiet" full disabled={pending} onClick={() => reset(blank)}>
              Cancel
            </Pill>
          ) : null}
          <Pill variant="flame" full disabled={pending || busy || !ready} onClick={save}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create this code"}
          </Pill>
        </div>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-[14px] text-dust">No codes yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-hair border-t border-hair">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-chalk">{row.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-dust">
                  <span className="tracking-[0.08em] text-ash">{row.code}</span>
                  {" · "}
                  {business
                    ? `${row.used} of ${row.maxUses} used`
                    : row.used > 0
                      ? "Used"
                      : "Unused"}
                  {row.email ? ` · ${row.email}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {business ? (
                  <button
                    type="button"
                    aria-label={`Edit ${row.name}`}
                    disabled={pending}
                    onClick={() => {
                      reset(toDraft(row));
                      formRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-dust transition-colors hover:text-flame disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}

                <button
                  type="button"
                  aria-label={`Remove ${row.name}`}
                  disabled={pending}
                  onClick={() => setRemoving(row)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-dust transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
          Nobody can type {removing?.code} again, and its uses leave the log below.
          {business ? " The rolls it created stop naming the business." : ""} The rolls themselves
          are untouched.
        </p>
      </Dialog>
    </>
  );
}
