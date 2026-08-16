"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

import { BackButton, PillLink } from "../../../components/Chrome";
import { Pencil } from "../../../components/Icons";
import { Plate } from "../../../components/Plate";
import { COVER_PRESETS, FILM } from "../../../mock";

export default function EditFilmInfo() {
  const [title, setTitle] = useState(FILM.title);
  const [cover, setCover] = useState(COVER_PRESETS[0]);

  return (
    <div className="flex min-h-full flex-col px-5 pt-4 pb-6">
      <BackButton href="/proto/film/settings" />

      <h1 className="display mt-5 text-center text-[30px] text-chalk">Edit your film info</h1>
      <p className="mt-3 text-center text-[15px] text-ash">
        Update your film&rsquo;s title and cover image.
      </p>

      <div className="mt-8">
        <p className="marking">Film title</p>
        <label className="mt-3 flex h-16 items-center gap-3 rounded-2xl bg-surface px-4 focus-within:ring-1 focus-within:ring-flame">
          <Pencil className="h-4 w-4 shrink-0 text-dust" />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Film title"
            className="w-full bg-transparent text-[17px] font-medium text-chalk focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-7 border-t border-hair pt-6">
        <p className="marking">Cover image</p>

        <div className="mt-4 flex items-center gap-5">
          <Plate index={cover} className="h-[200px] w-[110px] shrink-0 rounded-2xl" />
          <PillLink href="/proto/film/settings/info" variant="quiet" className="text-[14px]">
            Change Cover
          </PillLink>
        </div>

        <p className="mt-6 text-[14px] text-ash">Or choose a preset:</p>
        <div className="mt-3 flex gap-2.5">
          {COVER_PRESETS.map((preset) => (
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

      <div className="flex-1" />

      <PillLink href="/proto/film/settings" variant="light" full className="mt-8">
        Save
      </PillLink>
    </div>
  );
}
