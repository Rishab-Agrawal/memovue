"use client";

import { useState } from "react";

import { Pill, PillLink } from "@/components/roll/Chrome";
import { CoverChoice } from "@/components/roll/CoverChoice";
import { Dialog } from "@/components/roll/Dialog";
import { InvitationCover } from "@/components/roll/InvitationCover";
import { WizardShell } from "@/components/roll/WizardShell";
import { CoverError, prepareCover } from "@/lib/cover-upload";
import { formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { SHOT_TIERS } from "@/lib/roll-config";

import { useDraft } from "../DraftContext";

export default function StepCard() {
  const { draft, hostName } = useDraft();
  const now = useNow();
  const [picking, setPicking] = useState(false);

  const countdown = formatCountdown(draft.finishesAt.getTime() - now);
  const shots = SHOT_TIERS[draft.shotIndex];

  return (
    <>
      <WizardShell
        step={5}
        title="Design your roll invitation card."
        subtitle="This cover is the first thing guests see when they are invited to your roll."
        back="/new/reveal"
        next={{ label: "Next →", href: "/new/guests" }}
      >
        <div className="rounded-3xl bg-surface p-5">
          {/* A static miniature of the guest landing, not an iframe — it only has to show
              what the cover looks like with the title on it. */}
          <div className="mx-auto h-[330px] w-[165px] overflow-hidden rounded-[1.75rem] border-4 border-hair-bright">
            <InvitationCover
              mini
              coverIndex={draft.coverPreset}
              coverUrl={draft.coverPreviewUrl}
              title={draft.name || "Your roll"}
              hostName={hostName}
              countdown={countdown}
              shots={shots}
            >
              <div className="flex h-5 items-center rounded-full bg-surface/80 px-2 text-[7px] text-dust">
                Enter your name
              </div>
              <div className="flex h-5 items-center justify-center rounded-full bg-chalk text-[7px] font-medium text-void">
                Take your camera →
              </div>
            </InvitationCover>
          </div>

          <div className="mt-5 flex gap-3 border-t border-hair pt-5">
            <Pill variant="quiet" full className="px-3 text-[13px]" onClick={() => setPicking(true)}>
              Change Cover
            </Pill>
            <PillLink href="/new/card/preview" variant="quiet" full className="px-3 text-[13px]">
              Preview
            </PillLink>
          </div>
        </div>
      </WizardShell>

      <CoverDialog open={picking} onClose={() => setPicking(false)} />
    </>
  );
}

/**
 * The picked image is resized here but not uploaded — there is no roll yet to attach it to.
 * It rides along in the draft and goes up once the last step has created something for it to
 * belong to. See `StepGuests`.
 */
function CoverDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { draft, update, setCover, clearCover } = useDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Dialog
      open={open}
      title="Choose your cover"
      actions={
        <Pill variant="light" full onClick={onClose}>
          Done
        </Pill>
      }
    >
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
        onRemoveUpload={clearCover}
      />
    </Dialog>
  );
}
