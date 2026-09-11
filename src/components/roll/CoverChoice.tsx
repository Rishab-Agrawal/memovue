"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Pill } from "@/components/roll/Chrome";
import { Cover } from "@/components/roll/Cover";
import { Dialog } from "@/components/roll/Dialog";
import { Photo } from "@/components/roll/Icons";
import { COVERS } from "@/lib/imagery";

/** The shipped covers, by index — which is what `Roll.coverPreset` stores. */
const COVER_PRESETS = COVERS.map((_, index) => index);

/**
 * Choosing what stands behind a roll's title: a photo of your own, or one of the presets.
 *
 * Shared by the creation wizard and the roll's edit screen so the two cannot drift into
 * offering different covers. It is deliberately presentational — it reports what was picked
 * and renders what it is told is current. Where the bytes go differs between the two callers
 * (the wizard has no roll to upload to yet) and that difference stays with them.
 *
 * The choices live behind Change. Picking a preset replaces an uploaded photo, so there is no
 * separate Remove. `children` sit under Change, beside the cover.
 */
export function CoverChoice({
  previewUrl,
  preset,
  busy,
  error,
  onPickFile,
  onPickPreset,
  children,
}: {
  /** The uploaded cover, if there is one — an object URL mid-wizard, a signed URL after. */
  previewUrl: string | null;
  preset: number;
  busy?: boolean;
  error?: string | null;
  onPickFile: (file: File) => void;
  onPickPreset: (preset: number) => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-5">
        <Cover
          url={previewUrl}
          preset={preset}
          className="h-[200px] w-[110px] shrink-0 rounded-2xl"
        />

        <div className="flex flex-1 flex-col gap-2">
          <Pill variant="quiet" full disabled={busy} onClick={() => setOpen(true)}>
            {busy ? "Preparing…" : "Change image"}
          </Pill>
          {children}
        </div>
      </div>

      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Choose a cover"
        actions={
          <Pill variant="quiet" full onClick={() => setOpen(false)}>
            Cancel
          </Pill>
        }
      >
        <div className="grid grid-cols-4 gap-3 p-1">
          {COVER_PRESETS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={COVERS[option].label}
              // A preset is only the live cover when no photo is sitting on top of it.
              aria-pressed={!previewUrl && option === preset}
              onClick={() => {
                setOpen(false);
                onPickPreset(option);
              }}
              className={cn(
                "rounded-xl",
                !previewUrl &&
                  option === preset &&
                  "ring-2 ring-flame ring-offset-2 ring-offset-surface",
              )}
            >
              <Cover preset={option} className="aspect-[58/104] w-full rounded-xl" />
            </button>
          ))}
        </div>

        <label className="mt-4 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-chalk px-4 text-[14px] font-medium text-void transition-colors hover:bg-white">
          <Photo className="h-4 w-4" />
          Upload a photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Straight back to the screen behind, not to this box.
              if (file) {
                setOpen(false);
                onPickFile(file);
              }
            }}
          />
        </label>
      </Dialog>
    </div>
  );
}
