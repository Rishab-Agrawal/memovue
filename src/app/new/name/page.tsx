"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PillLink } from "@/components/roll/Chrome";
import { CoverChoice } from "@/components/roll/CoverChoice";
import { Pencil } from "@/components/roll/Icons";
import { WizardShell } from "@/components/roll/WizardShell";
import { CoverError, prepareCover } from "@/lib/cover-upload";

import { useDraft } from "../DraftContext";

/**
 * The roll's title and its cover, on one screen — the same pair, in the same order, that
 * `/rolls/[id]/settings/info` offers once the roll exists. Editing the two together and
 * creating them apart was the odd arrangement, not this one.
 *
 * There is no phone mockup: a cover shrunk to a third of its size inside a drawn bezel is
 * harder to judge than the same cover at the size the picker already shows it. What the
 * mockup was for lives on the Preview button, which puts the picture and the title together
 * at full size.
 *
 * The reference offers a SUGGESTIONS list under the field — "Sanjana's party", "Sanjana's
 * Birthday" and so on. Dropped: they are generated from a name we no longer collect, and a
 * host naming their own wedding does not need prompting.
 */
export default function StepName() {
  const { draft, update, setCover, clearCover } = useDraft();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    The picked image is resized here but not uploaded — there is no roll yet to attach it to.
    It rides along in the draft and goes up once the last step has created something for it
    to belong to. See `StepGuests`.
  */
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
