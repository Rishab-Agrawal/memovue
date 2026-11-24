"use client";

import type { CodeKind } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Pencil, Trash } from "@/components/roll/Icons";
import { Toggle } from "@/components/roll/Toggle";
import { cn } from "@/lib/cn";
import { formatDayYear } from "@/lib/format";

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
  name: string | null;
  url: string | null;
  email: string | null;
  logoUrl: string | null;
  maxUses: number;
  used: number;
}

/** One roll created with one code. */
export interface UseRow {
  id: string;
  rollName: string;
  createdAt: Date;
  user: { email: string };
  referrer: ReferrerRow;
}

interface Draft extends SponsorDraft {
  id: string;
  code: string;
  email: string;
  maxUses: string;
  sendEmail: boolean;
}

const blank: Draft = {
  ...blankSponsor,
  id: "",
  code: "",
  email: "",
  maxUses: "10",
  sendEmail: false,
};

function toDraft(row: ReferrerRow): Draft {
  return {
    ...blank,
    id: row.id,
    code: row.code,
    email: row.email ?? "",
    maxUses: String(row.maxUses),
    name: row.name ?? "",
    url: row.url ?? "",
    logoUrl: row.logoUrl ?? "",
  };
}

/** Whom a code went to: a business or person by name, else a person by address. */
const whom = (row: ReferrerRow) => row.name ?? row.email;

/** What a row is called in the list and the dialogs. */
const labelOf = (row: ReferrerRow) => whom(row) ?? row.code;

/**
 * One kind of code: the form that mints it, the codes with a use left, and the rolls created.
 * A spent code is only in the second list, where it can still be edited.
 *
 * Every code is editable after the fact, the code itself included: a business renames itself,
 * moves domain, or was typed in wrong on a Tuesday, and none of that is a reason to retire a code
 * that is already printed on somebody's cards; an individual's code minted for nobody yet gets
 * its address later. Rolls point at the row, not at the string.
 *
 * The business form puts the fields only we ever see first, then the three a guest does, then
 * the card they make. Ordering the form by audience is the only ordering that survives a new
 * field.
 */
export function ReferrerList({
  kind,
  unused,
  uses,
}: {
  kind: CodeKind;
  unused: ReferrerRow[];
  uses: UseRow[];
}) {
  const router = useRouter();
  const [showUsed, setShowUsed] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ReferrerRow | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);

  const business = kind === "BUSINESS";
  const editing = draft.id !== "";
  // Only offered with somewhere to send it.
  const sending = draft.sendEmail && draft.email.trim() !== "";

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
      form.set("email", draft.email);
      form.set("name", draft.name);
      if (sending) form.set("sendEmail", "on");
      if (business) {
        form.set("maxUses", draft.maxUses);
        appendSponsor(form, draft);
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

  const editButton = (row: ReferrerRow) => (
    <button
      type="button"
      aria-label={`Edit ${labelOf(row)}`}
      disabled={pending}
      onClick={() => {
        reset(toDraft(row));
        formRef.current?.scrollIntoView({ behavior: "smooth" });
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-dust transition-colors hover:text-flame disabled:pointer-events-none disabled:opacity-30"
    >
      <Pencil className="h-4 w-4" />
    </button>
  );

  // An individual's code may be left blank, and one is picked for it.
  const ready = !business || (draft.code.trim() !== "" && draft.name.trim() !== "");

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
          </>
        ) : (
          <>
            <Field
              label="Name (optional)"
              value={draft.name}
              onChange={(name) => set({ name })}
              placeholder="Only you see this"
            />
            <Field
              label="Email (optional)"
              value={draft.email}
              onChange={(email) => set({ email })}
              placeholder="priya@example.com"
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

        {draft.email.trim() ? (
          <Toggle
            on={draft.sendEmail}
            onChange={(sendEmail) => set({ sendEmail })}
            labelOn="Send email"
            labelOff="Don't send email"
          />
        ) : null}

        {business ? (
          <SponsorFields
            value={draft}
            onChange={set}
            busy={busy}
            onBusy={setBusy}
            onError={setError}
          />
        ) : null}

        <div className={editing ? "grid grid-cols-2 gap-3" : ""}>
          {editing ? (
            <Pill variant="quiet" full disabled={pending} onClick={() => reset(blank)}>
              Cancel
            </Pill>
          ) : null}
          <Pill variant="flame" full disabled={pending || busy || !ready} onClick={save}>
            {pending
              ? "Saving…"
              : sending
                ? editing
                  ? "Save and send email"
                  : "Create and send email"
                : editing
                  ? "Save changes"
                  : "Create this code"}
          </Pill>
        </div>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>

      <div role="group" aria-label="Show" className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
        {[false, true].map((used) => (
          <button
            key={String(used)}
            type="button"
            aria-pressed={used === showUsed}
            onClick={() => setShowUsed(used)}
            className={cn(
              "h-10 rounded-full text-[14px] font-medium transition-colors",
              used === showUsed ? "bg-chalk text-void" : "text-dust hover:text-chalk",
            )}
          >
            {used ? `Used · ${uses.length}` : `Unused · ${unused.length}`}
          </button>
        ))}
      </div>

      {showUsed ? (
        uses.length === 0 ? (
          <p className="mt-4 text-[14px] text-dust">No code has created a roll yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-hair border-t border-hair">
            {uses.map((use) => (
              <li key={use.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[15px] break-all text-chalk">{use.user.email}</span>
                    <span className="tabular shrink-0 text-[13px] text-dust">
                      {formatDayYear(use.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-ash">
                    <span className="tracking-[0.08em]">{use.referrer.code}</span>
                    {whom(use.referrer) ? ` · ${whom(use.referrer)}` : ""} · &ldquo;{use.rollName}&rdquo;
                  </p>
                </div>
                {editButton(use.referrer)}
              </li>
            ))}
          </ul>
        )
      ) : unused.length === 0 ? (
        <p className="mt-4 text-[14px] text-dust">No unused codes.</p>
      ) : (
        <ul className="mt-4 divide-y divide-hair border-t border-hair">
          {unused.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-chalk">
                  {whom(row) ?? "Not given to anybody yet"}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-dust">
                  <span className="tracking-[0.08em] text-ash">{row.code}</span>
                  {business ? ` · ${row.used} of ${row.maxUses} used` : ""}
                  {row.name && row.email ? ` · ${row.email}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {editButton(row)}

                <button
                  type="button"
                  aria-label={`Remove ${labelOf(row)}`}
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
        <p className="break-all">{removing ? labelOf(removing) : null}</p>
        <p className="mt-2">
          Nobody can type {removing?.code} again, and its uses leave the Used list.
          {business ? " The rolls it created stop naming the business." : ""} The rolls themselves
          are untouched.
        </p>
      </Dialog>
    </>
  );
}
