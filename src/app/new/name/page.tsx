"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PillLink } from "@/components/roll/Chrome";
import { CoverChoice } from "@/components/roll/CoverChoice";
import { Pencil } from "@/components/roll/Icons";
import { WizardShell } from "@/components/roll/WizardShell";
import { CoverError, prepareCover } from "@/lib/cover-upload";

import { useDraft } from "../DraftContext";

/** Step 1: the roll's title and cover, the same pair `/rolls/[id]/settings/info` edits later. */
export default function StepName() {
  const { draft, update, setCover, clearCover } = useDraft();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <WizardShell
      step={1}
      title="Roll name and cover"
      back="/rolls"
      next={{ label: "Next →", href: "/new/start", inert: !draft.name.trim() }}
    >
      <p className="marking">Roll title</p>
      <label className="mt-3 flex h-16 items-center gap-3 rounded-2xl bg-surface px-4 focus-within:ring-1 focus-within:ring-flame">
        <Pencil className="h-4 w-4 shrink-0 text-dust" />
        <input
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
          onKeyDown={(event) =>
            event.key === "Enter" && draft.name.trim() && router.push("/new/start")
          }
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
    </WizardShell>
  );
}
