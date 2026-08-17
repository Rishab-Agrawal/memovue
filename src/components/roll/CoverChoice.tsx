"use client";

import { cn } from "@/lib/cn";

import { Cover } from "@/components/roll/Cover";
import { Photo, Trash } from "@/components/roll/Icons";

/** The nine gradients `Plate` knows how to draw. */
export const COVER_PRESETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Choosing what stands behind a roll's title: a photo of your own, or one of the presets.
 *
 * Shared by the creation wizard and the roll's edit screen so the two cannot drift into
 * offering different covers. It is deliberately presentational — it reports what was picked
 * and renders what it is told is current. Where the bytes go differs between the two callers
 * (the wizard has no roll to upload to yet) and that difference stays with them.
 */
export function CoverChoice({
  previewUrl,
  preset,
  busy,
  error,
  onPickFile,
  onPickPreset,
  onRemoveUpload,
}: {
  /** The uploaded cover, if there is one — an object URL mid-wizard, a signed URL after. */
  previewUrl: string | null;
  preset: number;
  busy?: boolean;
  error?: string | null;
  onPickFile: (file: File) => void;
  onPickPreset: (preset: number) => void;
  onRemoveUpload: () => void;
}) {
  return (
    <div>
      <div className="flex items-start gap-5">
        <Cover
          url={previewUrl}
          preset={preset}
          className="h-[200px] w-[110px] shrink-0 rounded-2xl"
        />

        <div className="flex-1">
          <label
            className={cn(
              "inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-chalk px-4 text-[14px] font-medium text-void transition-colors hover:bg-white",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <Photo className="h-4 w-4" />
            {busy ? "Preparing…" : previewUrl ? "Replace photo" : "Upload a photo"}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Cleared so picking the same file twice in a row still fires a change.
                event.target.value = "";
                if (file) onPickFile(file);
              }}
            />
          </label>

          {previewUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRemoveUpload}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-hair-bright text-[14px] text-danger transition-colors"
            >
              <Trash className="h-4 w-4" />
              Remove photo
            </button>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-ash">
              Your photo is resized on your phone before it uploads. Or pick one of the covers
              below.
            </p>
          )}
        </div>
      </div>

      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}

      <div className="mt-5 flex gap-2.5 overflow-x-auto no-scrollbar">
        {COVER_PRESETS.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={`Cover ${option + 1}`}
            // A preset is only the live cover when no photo is sitting on top of it.
            aria-pressed={!previewUrl && option === preset}
            onClick={() => onPickPreset(option)}
            className={cn(
              "shrink-0 rounded-xl",
              !previewUrl &&
                option === preset &&
                "ring-2 ring-flame ring-offset-2 ring-offset-page",
            )}
          >
            <Cover preset={option} className="h-[104px] w-[58px] rounded-xl" />
          </button>
        ))}
      </div>
    </div>
  );
}
