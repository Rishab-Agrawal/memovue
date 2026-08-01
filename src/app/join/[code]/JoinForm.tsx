"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

import { type JoinState, joinAction, reclaimAction } from "./actions";

export interface JoinFormConfig {
  code: string;
  relationMode: "sides" | "honoree" | "none";
  asksRelation: boolean;
  relationPrompt: string;
  partnerA: string | null;
  partnerB: string | null;
  /** After reveal there are no shots left to take — joining is only to view the album. */
  viewOnly: boolean;
}

export function JoinForm({ config }: { config: JoinFormConfig }) {
  const [state, setState] = useState<JoinState>({});
  const [name, setName] = useState("");
  const [side, setSide] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const sideOptions = [
    { value: "A", label: config.partnerA ?? "" },
    { value: "B", label: config.partnerB ?? "" },
    { value: "BOTH", label: "Both" },
  ].filter((option) => option.label);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setState({});
    startTransition(async () => {
      const result = await joinAction(config.code, formData);
      if (result) setState(result);
    });
  }

  function reclaim() {
    setState({});
    startTransition(async () => {
      const result = await reclaimAction(config.code, name);
      if (result) setState(result);
    });
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-6">
      {state.error ? (
        <p
          className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-[14px] text-danger"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <TextField
        label="Your name"
        name="name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (state.nameTaken) setState({});
        }}
        autoComplete="name"
        autoFocus
        required
        maxLength={40}
        placeholder="Riya Sharma"
        error={state.fields?.name}
        hint="This gets shown next to every photo you take."
      />

      {state.nameTaken ? (
        <div className="-mt-2 flex flex-col gap-3 rounded-md border border-marigold/40 bg-marigold/8 p-4">
          <p className="text-[14px] leading-relaxed text-paper">
            Someone already joined as <strong>{name.trim()}</strong>. Add your surname or something
            that tells you apart — it&rsquo;s how everyone finds your photos later.
          </p>
          <button
            type="button"
            onClick={reclaim}
            disabled={pending}
            className="self-start text-[14px] text-marigold underline underline-offset-4 disabled:opacity-50"
          >
            That&rsquo;s me — I&rsquo;m on a new phone
          </button>
        </div>
      ) : null}

      {config.asksRelation && config.relationMode === "sides" && sideOptions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium tracking-wide text-paper-dim">
            {config.relationPrompt}
          </span>
          <input type="hidden" name="relationSide" value={side} />
          <div className="grid grid-cols-3 gap-2">
            {sideOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={side === option.value}
                onClick={() => setSide(option.value)}
                className={cn(
                  "min-h-12 truncate rounded-md border px-2 text-[15px] transition-colors",
                  side === option.value
                    ? "border-ember bg-ember/12 font-medium text-paper"
                    : "border-line bg-ink-inset text-paper-dim",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {state.fields?.relationSide ? (
            <p className="text-[13px] text-danger" role="alert">
              {state.fields.relationSide}
            </p>
          ) : null}
        </div>
      ) : null}

      {config.asksRelation ? (
        <TextField
          label={
            config.relationMode === "sides" ? "How do you know them?" : config.relationPrompt
          }
          name="relation"
          maxLength={60}
          placeholder="Cousin"
          error={state.fields?.relation}
        />
      ) : null}

      <Button type="submit" size="lg" full disabled={pending || !name.trim()}>
        {pending ? "Joining…" : config.viewOnly ? "See the album" : "Start shooting"}
      </Button>
    </form>
  );
}
