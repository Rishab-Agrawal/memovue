"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PillLink } from "@/components/roll/Chrome";
import { CoverChoice } from "@/components/roll/CoverChoice";
import { Pencil } from "@/components/roll/Icons";
import { WizardShell } from "@/components/roll/WizardShell";
import { REFERRALS } from "@/lib/constants";
import { CoverError, prepareCover } from "@/lib/cover-upload";

import { checkReferralAction } from "../actions";
import { useDraft } from "../DraftContext";

/** Step 1: the roll's title and cover, the same pair `/rolls/[id]/settings/info` edits later. */
export default function StepName() {
  const { draft, update, setCover, clearCover } = useDraft();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const code = draft.referralCode.trim();

  // Resized now, uploaded once the roll exists (see `StepGuests`).
  const pick = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const { blob, previewUrl } = await prepareCover(file);
      setCover(blob, previewUrl);
    } catch (cause) {
      setError(cause instanceof CoverError ? cause.message : "We couldn't use that image.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Onward — but a referral code that was typed has to name a business first, or the host walks
   * four more steps before finding out that the card their florist gave them was mistyped.
   */
  const go = async () => {
    if (!draft.name.trim()) return;

    if (REFERRALS && code) {
      setChecking(true);
      const result = await checkReferralAction({ code });
      setChecking(false);
      if (!result.ok) {
        setCodeError(result.error);
        return;
      }
    }
    router.push("/new/start");
  };

  return (
    <WizardShell
      step={1}
      title="Roll name and cover"
      back="/rolls"
      next={{
        label: checking ? "Checking…" : "Next →",
        href: "/new/start",
        inert: !draft.name.trim() || checking,
      }}
      // A step with nothing to check stays a plain link to the next one.
      onNext={REFERRALS && code ? () => void go() : undefined}
    >
      <p className="marking">Roll title</p>
      <label className="mt-3 flex h-16 items-center gap-3 rounded-2xl bg-surface px-4 focus-within:ring-1 focus-within:ring-flame">
        <Pencil className="h-4 w-4 shrink-0 text-dust" />
        <input
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
          onKeyDown={(event) => event.key === "Enter" && void go()}
          aria-label="Event name"
          className="w-full bg-transparent text-[17px] font-medium text-chalk placeholder:text-dust focus:outline-none"
        />
      </label>

      <div className="mt-7 border-t border-hair pt-6">
        <p className="marking">Invitation cover image</p>

        <div className="mt-4">
          <CoverChoice
            previewUrl={draft.coverPreviewUrl}
            preset={draft.coverPreset}
            busy={busy}
            error={error}
            onPickFile={(file) => void pick(file)}
            onPickPreset={(preset) => {
              // Choosing a gradient means choosing it over the photo, not behind it.
              clearCover();
              update({ coverPreset: preset });
            }}
          >
            <PillLink href="/new/preview" variant="light" full className="px-4">
              Preview invitation
            </PillLink>
          </CoverChoice>
        </div>
      </div>

      {REFERRALS ? (
        <div className="mt-7 border-t border-hair pt-6">
          <p className="marking">Referral code (optional)</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ash">
            If a wedding business sent you here, put their code in — their name goes on your
            roll&rsquo;s home screen.
          </p>

          <input
            value={draft.referralCode}
            onChange={(event) => {
              update({ referralCode: event.target.value });
              setCodeError(null);
            }}
            onKeyDown={(event) => event.key === "Enter" && void go()}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. BLOOM24"
            aria-label="Referral code"
            aria-invalid={codeError ? "true" : undefined}
            className="mt-3 h-14 w-full rounded-2xl bg-surface px-4 text-[16px] tracking-[0.08em] text-chalk uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
          />

          {codeError ? <p className="mt-2 text-[13px] text-danger">{codeError}</p> : null}
        </div>
      ) : null}
    </WizardShell>
  );
}
