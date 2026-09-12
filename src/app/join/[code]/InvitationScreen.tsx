"use client";

import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Pencil } from "@/components/roll/Icons";
import { InvitationCover } from "@/components/roll/InvitationCover";
import { Honeypot, useFormAge } from "@/components/ui/Honeypot";
import { formatDateTime } from "@/lib/format";
import type { RollPhase } from "@/lib/roll-access";

import { joinAction, type JoinState } from "./actions";

/**
 * What a guest gets after scanning the QR. No account, no install — a name and a camera.
 *
 * Someone who *is* signed in gets the same screen, with their name already in the box. It is
 * still a text field rather than a fixed label, because the name here is what the other guests
 * see beside your photographs, and is not always the one on your account.
 */
export function InvitationScreen({
  code,
  title,
  hostName,
  coverPreset,
  coverUrl,
  shots,
  countdown,
  phase,
  opensAt,
  defaultName,
}: {
  code: string;
  title: string;
  hostName: string;
  coverPreset: number;
  coverUrl: string | null;
  shots: number;
  countdown: string;
  phase: RollPhase;
  opensAt: string;
  /** The signed-in guest's own name, if there is one. */
  defaultName?: string;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [state, setState] = useState<JoinState>({});
  const [pending, startTransition] = useTransition();

  const [trap, setTrap] = useState("");
  // Not reset by a refused attempt, on purpose: if the server thought that was too quick, the
  // retry is by definition slower and goes through.
  const formAge = useFormAge();

  const scheduled = phase === "scheduled";

  const submit = () => {
    const data = new FormData();
    data.set("name", name);
    data.set("trap", trap);
    data.set("elapsedMs", String(formAge()));
    startTransition(async () => setState(await joinAction(code, data)));
  };

  return (
    <div className="h-dvh">
      <InvitationCover
        coverIndex={coverPreset}
        coverUrl={coverUrl}
        title={title}
        hostName={hostName}
        countdown={scheduled ? `Opens ${formatDateTime(new Date(opensAt))}` : countdown}
        shots={shots}
      >
        <label className="flex h-14 items-center gap-3 rounded-2xl bg-surface/85 px-4 backdrop-blur-sm focus-within:ring-1 focus-within:ring-flame">
          <Pencil className="h-4 w-4 shrink-0 text-dust" />
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setState({});
            }}
            placeholder="Enter your name"
            aria-label="Your name"
            disabled={scheduled}
            className="w-full bg-transparent text-[16px] text-chalk placeholder:text-dust focus:outline-none"
          />
        </label>

        <Honeypot value={trap} onChange={setTrap} />

        {state.error ? <p className="text-[13px] text-danger">{state.error}</p> : null}
        {state.fields?.name ? (
          <p className="text-[13px] text-danger">{state.fields.name}</p>
        ) : null}

        <Pill
          variant="light"
          full
          disabled={!name.trim() || pending || scheduled}
          onClick={submit}
        >
          {pending ? "One moment…" : "Join roll →"}
        </Pill>
      </InvitationCover>
    </div>
  );
}
