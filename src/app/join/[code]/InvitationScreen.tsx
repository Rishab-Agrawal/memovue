"use client";

import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Pencil } from "@/components/roll/Icons";
import { InvitationCover } from "@/components/roll/InvitationCover";
import { formatDateTime } from "@/lib/format";
import type { RollPhase } from "@/lib/roll-access";

import { joinAction, reclaimAction, type JoinState } from "./actions";

/**
 * What a guest gets after scanning the QR. No account, no install — a name and a camera.
 */
export function InvitationScreen({
  code,
  title,
  hostName,
  coverPreset,
  shots,
  countdown,
  phase,
  opensAt,
}: {
  code: string;
  title: string;
  hostName: string;
  coverPreset: number;
  shots: number;
  countdown: string;
  phase: RollPhase;
  opensAt: string;
}) {
  const [name, setName] = useState("");
  const [state, setState] = useState<JoinState>({});
  const [pending, startTransition] = useTransition();

  const scheduled = phase === "scheduled";

  const submit = () => {
    const data = new FormData();
    data.set("name", name);
    startTransition(async () => setState(await joinAction(code, data)));
  };

  const reclaim = () => {
    startTransition(async () => setState(await reclaimAction(code, name)));
  };

  return (
    <div className="h-dvh">
      <InvitationCover
        coverIndex={coverPreset}
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

        {state.error ? <p className="text-[13px] text-danger">{state.error}</p> : null}
        {state.fields?.name ? (
          <p className="text-[13px] text-danger">{state.fields.name}</p>
        ) : null}

        {state.nameTaken ? (
          /*
            Someone is already shooting under this name. It is usually the same person on a
            new phone, so the recovery is offered rather than the name simply refused — but
            taking it over signs the other device out, which is stated plainly because the
            alternative is two people quietly sharing one shot quota.
          */
          <div className="rounded-2xl bg-surface/85 p-4 backdrop-blur-sm">
            <p className="text-[14px] leading-relaxed text-ash">
              Someone already joined as <span className="text-chalk">{name}</span>. If that
              was you on another phone, take it back — the other device gets signed out.
            </p>
            <Pill variant="flame" full className="mt-3" disabled={pending} onClick={reclaim}>
              That&rsquo;s me, I&rsquo;m on a new phone
            </Pill>
          </div>
        ) : (
          <Pill
            variant="light"
            full
            disabled={!name.trim() || pending || scheduled}
            onClick={submit}
          >
            {pending ? "One moment…" : "Take your camera →"}
          </Pill>
        )}
      </InvitationCover>
    </div>
  );
}
