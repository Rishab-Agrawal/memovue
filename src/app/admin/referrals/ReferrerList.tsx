"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Pencil, Photo, Trash } from "@/components/roll/Icons";
import { SponsorCard } from "@/components/roll/Sponsor";
import { decode, processLogo } from "@/lib/image";

import { removeReferrerAction, saveReferrerAction } from "../actions";

export interface ReferrerRow {
  id: string;
  code: string;
  name: string;
  url: string | null;
  email: string | null;
  logoUrl: string | null;
  /** How many rolls this code has created. The whole point of the programme, counted. */
  rolls: number;
}

interface Draft {
  id: string;
  code: string;
  name: string;
  url: string;
  email: string;
  logoUrl: string;
  /** A picked file, already shrunk. Held until Save, so nothing uploads on a cancelled edit. */
  logo: Blob | null;
  /** An object URL for `logo`, so the preview shows the bytes that will actually be stored. */
  logoPreview: string | null;
}

const blank: Draft = {
  id: "",
  code: "",
  name: "",
  url: "",
  email: "",
  logoUrl: "",
  logo: null,
  logoPreview: null,
};

function toDraft(row: ReferrerRow): Draft {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    url: row.url ?? "",
    email: row.email ?? "",
    logoUrl: row.logoUrl ?? "",
    logo: null,
    logoPreview: null,
  };
}

/**
 * The codes, and the one form that both mints and edits them.
 *
 * Everything is editable after the fact, the code included: a business renames itself, moves
 * domain, or was typed in wrong on a Tuesday, and none of that is a reason to retire a code
 * that is already printed on somebody's cards. Rolls point at the row, not at the string.
 *
 * The form previews the card with the same component the roll screen renders. A logo is either
 * a URL on their server or a file we host for a business that has neither a site nor a CDN, and
 * the only way to know whether one survives a 48px square is to look at it before saving.
 */
export function ReferrerList({ rows }: { rows: ReferrerRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ReferrerRow | null>(null);
  const [pending, startTransition] = useTransition();

  const editing = draft.id !== "";

  const set = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  /** Revokes whatever preview it displaces; the updater itself must stay pure. */
  const reset = (next: Draft) => {
    if (draft.logoPreview) URL.revokeObjectURL(draft.logoPreview);
    setDraft(next);
    setError(null);
  };

  const pickLogo = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const source = await decode(file);
      const logo = await processLogo(
        source as CanvasImageSource & { width: number; height: number },
      );
      if (draft.logoPreview) URL.revokeObjectURL(draft.logoPreview);
      // An uploaded logo replaces a typed one: the card has room for a single picture.
      set({ logo, logoPreview: URL.createObjectURL(logo), logoUrl: "" });
    } catch {
      setError("We couldn't read that image. Try a JPEG or PNG.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("id", draft.id);
      form.set("code", draft.code);
      form.set("name", draft.name);
      form.set("url", draft.url);
      form.set("email", draft.email);
      form.set("logoUrl", draft.logoUrl);
      if (draft.logo) form.set("logo", draft.logo, "logo.jpg");

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

  const ready = draft.code.trim() !== "" && draft.name.trim() !== "";
  const shownLogo = draft.logoPreview || draft.logoUrl.trim() || null;

  return (
    <>
      <div className="mt-8 space-y-4 rounded-2xl bg-surface p-5">
        <p className="marking">{editing ? `Editing ${draft.code}` : "New code"}</p>

        <Field
          label="Code"
          value={draft.code}
          onChange={(code) => set({ code })}
          placeholder="BLOOM24"
          className="tracking-[0.08em] uppercase"
        />
        <Field
          label="Business name"
          value={draft.name}
          onChange={(name) => set({ name })}
          placeholder="Bloom Events"
        />
        <Field
          label="Website (optional)"
          value={draft.url}
          onChange={(url) => set({ url })}
          placeholder="https://bloomevents.in"
        />
        <Field
          label="Email for new rolls (optional)"
          value={draft.email}
          onChange={(email) => set({ email })}
          placeholder="hello@bloomevents.in"
        />

        <div>
          <p className="marking">Logo (optional)</p>
          <Field
            label="Logo URL"
            hideLabel
            value={draft.logoUrl}
            onChange={(logoUrl) => {
              if (draft.logoPreview) URL.revokeObjectURL(draft.logoPreview);
              // Typing a URL drops a file picked but not yet saved, and vice versa.
              set({ logoUrl, logo: null, logoPreview: null });
            }}
            placeholder="https://bloomevents.in/logo.png"
          />

          <label className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-hair-bright text-[14px] text-chalk transition-colors hover:text-flame">
            <Photo className="h-4 w-4" />
            {busy ? "Preparing…" : draft.logo ? "Image ready — choose another" : "Or upload an image"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void pickLogo(file);
                // Cleared, so picking the same file twice still fires a change.
                event.target.value = "";
              }}
            />
          </label>
        </div>

        {/* Exactly what a guest will see, drawn by the component that draws it there. */}
        {draft.name.trim() ? (
          <div>
            <p className="marking">Preview</p>
            <div className="mt-2 rounded-2xl bg-void p-3">
              <SponsorCard
                name={draft.name.trim()}
                url={draft.url.trim() || null}
                logoUrl={shownLogo}
              />
            </div>
          </div>
        ) : null}

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
                  <p className="mt-0.5 truncate text-[13px] text-dust">
                    <span className="tracking-[0.08em] text-ash">{row.code}</span>
                    {" · "}
                    {row.rolls} roll{row.rolls === 1 ? "" : "s"}
                    {row.email ? ` · ${row.email}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${row.name}`}
                    disabled={pending}
                    onClick={() => {
                      reset(toDraft(row));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-dust transition-colors hover:text-flame disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

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
  hideLabel,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  /** For a field that sits under a heading of its own, where a second label reads as a typo. */
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className="block">
      <span className={hideLabel ? "sr-only" : "marking"}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={label}
        className={`mt-2 h-12 w-full rounded-2xl bg-void px-4 text-[15px] text-chalk placeholder:normal-case placeholder:tracking-normal placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame ${className ?? ""}`}
      />
    </label>
  );
}
