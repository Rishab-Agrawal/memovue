"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { EditBackButton } from "@/components/roll/Confirm";
import { CoverChoice } from "@/components/roll/CoverChoice";
import { Pencil } from "@/components/roll/Icons";
import { CoverError, prepareCover, removeCover, uploadCover } from "@/lib/cover-upload";

import { updateInfoAction } from "../../actions";

export function EditInfoForm({
  rollId,
  name: initialName,
  coverPreset: initialCover,
  coverUrl: initialCoverUrl,
}: {
  rollId: string;
  name: string;
  coverPreset: number;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [cover, setCover] = useState(initialCover);

  /*
    Two pieces of cover state, because a picked photo is not an uploaded one.

    `previewUrl` is what the host is looking at — either the signed URL of the cover already
    on the roll, or a local object URL for one they have just picked. `picked` is the blob
    that still has to travel. Save reconciles them.
  */
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialCoverUrl);
  const [picked, setPicked] = useState<Blob | null>(null);
  const [removed, setRemoved] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  // Every object URL this screen mints, so none of them outlive it.
  const minted = useRef<string[]>([]);
  useEffect(() => {
    const urls = minted.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const pick = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const prepared = await prepareCover(file);
      minted.current.push(prepared.previewUrl);
      setPicked(prepared.blob);
      setPreviewUrl(prepared.previewUrl);
      setRemoved(false);
    } catch (cause) {
      setError(cause instanceof CoverError ? cause.message : "We couldn't use that image.");
    } finally {
      setBusy(false);
    }
  };

  const dropCover = () => {
    setPicked(null);
    setPreviewUrl(null);
    // Only a cover that was already on the roll needs deleting server-side; discarding one
    // that never left this screen is purely local.
    setRemoved(Boolean(initialCoverUrl));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        if (picked) await uploadCover(rollId, picked);
        else if (removed) await removeCover(rollId);
      } catch (cause) {
        setError(cause instanceof CoverError ? cause.message : "We couldn't save that cover.");
        return;
      }

      const result = await updateInfoAction(rollId, { name, coverPreset: cover });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/rolls/${rollId}/settings`);
      router.refresh();
    });
  };

  const working = pending || busy;
  /** Anything the Save button would send. Leaving with it unsent used to cost it silently. */
  const dirty = name !== initialName || cover !== initialCover || picked !== null || removed;

  return (
    <div className="pad-safe-top flex min-h-dvh flex-col px-5 pb-[calc(var(--safe-bottom)+1.5rem)]">
      <EditBackButton href={`/rolls/${rollId}/settings`} dirty={dirty} />

      <h1 className="display mt-5 text-center text-[30px] text-chalk">Edit your roll info</h1>
      <p className="mt-3 text-center text-[15px] text-ash">
        Update your roll&rsquo;s title and cover image.
      </p>

      <div className="mt-8">
        <p className="marking">Roll title</p>
        <label className="mt-3 flex h-16 items-center gap-3 rounded-2xl bg-surface px-4 focus-within:ring-1 focus-within:ring-flame">
          <Pencil className="h-4 w-4 shrink-0 text-dust" />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && !working && save()}
            aria-label="Roll title"
            className="w-full bg-transparent text-[17px] font-medium text-chalk focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-7 border-t border-hair pt-6">
        <p className="marking">Cover image</p>

        <div className="mt-4">
          <CoverChoice
            previewUrl={previewUrl}
            preset={cover}
            busy={busy}
            error={error}
            onPickFile={(file) => void pick(file)}
            onPickPreset={(preset) => {
              setCover(preset);
              dropCover();
            }}
            onRemoveUpload={dropCover}
          />
        </div>
      </div>

      <div className="flex-1" />

      <Pill variant="light" full className="mt-8" disabled={working} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Pill>
    </div>
  );
}
