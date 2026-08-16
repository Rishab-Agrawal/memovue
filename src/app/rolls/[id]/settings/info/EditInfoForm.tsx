"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";

import { BackButton, Pill } from "@/components/roll/Chrome";
import { Pencil } from "@/components/roll/Icons";
import { Plate } from "@/components/roll/Plate";

import { updateInfoAction } from "../../actions";

const PRESETS = [0, 1, 2, 3, 4];

export function EditInfoForm({
  rollId,
  name: initialName,
  coverPreset: initialCover,
}: {
  rollId: string;
  name: string;
  coverPreset: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [cover, setCover] = useState(initialCover);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateInfoAction(rollId, { name, coverPreset: cover });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/rolls/${rollId}/settings`);
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-4 pb-6">
      <BackButton href={`/rolls/${rollId}/settings`} />

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
            aria-label="Roll title"
            className="w-full bg-transparent text-[17px] font-medium text-chalk focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-7 border-t border-hair pt-6">
        <p className="marking">Cover image</p>

        <div className="mt-4 flex items-center gap-5">
          <Plate index={cover} className="h-[200px] w-[110px] shrink-0 rounded-2xl" />
          <p className="text-[14px] leading-relaxed text-ash">
            Pick one of the covers below. Uploading your own is coming.
          </p>
        </div>

        <div className="mt-6 flex gap-2.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={`Cover ${preset + 1}`}
              aria-pressed={preset === cover}
              onClick={() => setCover(preset)}
              className={cn(
                "rounded-xl",
                preset === cover && "ring-2 ring-flame ring-offset-2 ring-offset-page",
              )}
            >
              <Plate index={preset} className="h-[128px] w-[68px] rounded-xl" />
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}

      <div className="flex-1" />

      <Pill variant="light" full className="mt-8" disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Pill>
    </div>
  );
}
