"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill, PillLink } from "@/components/roll/Chrome";

import {
  SponsorFields,
  type SponsorDraft,
  appendSponsor,
  forgetLogoPreview,
} from "../SponsorFields";
import { saveSampleCardAction } from "../actions";

/**
 * The card on the sample album, edited from here rather than from the album.
 *
 * The album is a screenshot, so it cannot carry its own settings control: a gear in the corner
 * of a picture sent to a florist says "this is somebody's admin screen", which is exactly what
 * the picture is meant not to say.
 */
export function SampleCard({ current }: { current: SponsorDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SponsorDraft>(current);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<SponsorDraft>) => {
    setDraft((next) => ({ ...next, ...patch }));
    setError(null);
    setSaved(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      appendSponsor(form, draft);

      const result = await saveSampleCardAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The blob is on the server now; keeping the preview would out-live its own upload.
      forgetLogoPreview(draft);
      setDraft((next) => ({ ...next, logo: null, logoPreview: null }));
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <>
      <div className="mt-8 space-y-4 rounded-2xl bg-surface p-5">
        <SponsorFields
          value={draft}
          onChange={set}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
        />

        <Pill
          variant="flame"
          full
          disabled={pending || busy || draft.name.trim() === ""}
          onClick={save}
        >
          {pending ? "Saving…" : "Save this card"}
        </Pill>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        {saved && !error ? <p className="text-[13px] text-ash">Saved.</p> : null}
      </div>

      <PillLink href="/admin/sample/album" variant="quiet" full className="mt-4">
        Open the album to screenshot
      </PillLink>
    </>
  );
}
