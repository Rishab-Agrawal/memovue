"use client";

import { Photo } from "@/components/roll/Icons";
import { SponsorCard } from "@/components/roll/Sponsor";
import { decode, processLogo } from "@/lib/image";

/**
 * The three things a guest actually sees on a sponsor card — business, link, picture — and a
 * preview of the card they make.
 *
 * Shared by the referral codes screen and the sample album's card, so the two cannot drift into
 * accepting different things. What differs between them is everything a guest never sees: a
 * code, an address to notify. That stays with each screen.
 *
 * A logo is either a URL on their server or a file we host for a business that has neither a
 * site nor a CDN. The preview is the real card component, because the only way to know whether
 * a logo survives a 48px square is to look at it before saving.
 */

export interface SponsorDraft {
  name: string;
  url: string;
  logoUrl: string;
  /** A picked file, already shrunk. Held until Save, so nothing uploads on a cancelled edit. */
  logo: Blob | null;
  /** An object URL for `logo`, so the preview shows the bytes that will actually be stored. */
  logoPreview: string | null;
}

export const blankSponsor: SponsorDraft = {
  name: "",
  url: "",
  logoUrl: "",
  logo: null,
  logoPreview: null,
};

/** Drops a preview's object URL. Callers own the draft, so they own its lifetime. */
export function forgetLogoPreview(draft: SponsorDraft) {
  if (draft.logoPreview) URL.revokeObjectURL(draft.logoPreview);
}

/** Adds the three fields to a `FormData` in the shape both actions parse. */
export function appendSponsor(form: FormData, draft: SponsorDraft) {
  form.set("name", draft.name);
  form.set("url", draft.url);
  form.set("logoUrl", draft.logoUrl);
  if (draft.logo) form.set("logo", draft.logo, "logo.jpg");
}

export function SponsorFields({
  value,
  onChange,
  busy,
  onBusy,
  onError,
}: {
  value: SponsorDraft;
  onChange: (patch: Partial<SponsorDraft>) => void;
  /** Whether a picked file is still being decoded. Owned by the parent, which disables Save. */
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string | null) => void;
}) {
  const pickLogo = async (file: File) => {
    onError(null);
    onBusy(true);
    try {
      const source = await decode(file);
      const logo = await processLogo(
        source as CanvasImageSource & { width: number; height: number },
      );
      forgetLogoPreview(value);
      // An uploaded logo replaces a typed one: the card has room for a single picture.
      onChange({ logo, logoPreview: URL.createObjectURL(logo), logoUrl: "" });
    } catch {
      onError("We couldn't read that image. Try a JPEG or PNG.");
    } finally {
      onBusy(false);
    }
  };

  const shownLogo = value.logoPreview || value.logoUrl.trim() || null;

  return (
    <>
      <Field
        label="Business name"
        value={value.name}
        onChange={(name) => onChange({ name })}
        placeholder="Bloom Events"
      />
      <Field
        label="Website (optional)"
        value={value.url}
        onChange={(url) => onChange({ url })}
        placeholder="https://bloomevents.in"
      />

      <div>
        <p className="marking">Logo (optional)</p>
        <Field
          label="Logo URL"
          hideLabel
          value={value.logoUrl}
          onChange={(logoUrl) => {
            forgetLogoPreview(value);
            // Typing a URL drops a file picked but not yet saved, and vice versa.
            onChange({ logoUrl, logo: null, logoPreview: null });
          }}
          placeholder="https://bloomevents.in/logo.png"
        />

        <label className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-hair-bright text-[14px] text-chalk transition-colors hover:text-flame">
          <Photo className="h-4 w-4" />
          {busy ? "Preparing…" : value.logo ? "Image ready — choose another" : "Or upload an image"}
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
      {value.name.trim() ? (
        <div>
          <p className="marking">Preview</p>
          <div className="mt-2 rounded-2xl bg-void p-3">
            <SponsorCard
              name={value.name.trim()}
              url={value.url.trim() || null}
              logoUrl={shownLogo}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function Field({
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
