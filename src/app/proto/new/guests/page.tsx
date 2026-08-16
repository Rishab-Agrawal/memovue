"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

import { Pill } from "../../components/Chrome";
import { Counter } from "../../components/Counter";
import { Dialog } from "../../components/Dialog";
import { Person } from "../../components/Icons";
import { Plate } from "../../components/Plate";
import { Toggle } from "../../components/Toggle";
import { WizardShell } from "../../components/WizardShell";
import { COUPON, ROLL } from "../../mock";
import { PARTICIPANT_TIERS, SHOT_TIERS, formatPrice, priceFor } from "../../rules";
import { useDraft } from "../DraftContext";

type Stage = "form" | "coupon" | "created";

export default function StepGuests() {
  const { draft, update } = useDraft();
  const router = useRouter();

  const variant = useSearchParams().get("v");
  const [stage, setStage] = useState<Stage>(
    variant === "coupon" ? "coupon" : variant === "created" ? "created" : "form",
  );
  const [code, setCode] = useState("");
  const [rejected, setRejected] = useState(false);

  const price = priceFor(draft.participantIndex, draft.shotIndex);

  const apply = () => {
    if (code.trim().toUpperCase() === COUPON) {
      setRejected(false);
      setStage("created");
    } else {
      setRejected(true);
    }
  };

  return (
    <>
      <WizardShell
        step={6}
        title="How many guests for your roll?"
        subtitle="Make sure all guests have a chance to take the most amazing photo from your event."
        back="/proto/new/card"
        next={{ label: "Create →", href: "/proto/new/guests" }}
        onNext={() => setStage("coupon")}
      >
        {/* ---------------------------------------------------------- participants */}
        <div className="flex items-start justify-between gap-4">
          <p className="display-md text-[26px] text-chalk">
            Up to
            <br />
            {PARTICIPANT_TIERS[draft.participantIndex]} Participants
          </p>
          <p className="shrink-0 pt-2 text-[15px] text-dust" data-testid="price">
            {formatPrice(price)}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-8 gap-1.5">
          {PARTICIPANT_TIERS.map((cap, index) => {
            const filled = index <= draft.participantIndex;
            return (
              <button
                key={cap}
                type="button"
                aria-label={`Up to ${cap} participants`}
                aria-pressed={index === draft.participantIndex}
                onClick={() => update({ participantIndex: index })}
                className={cn(
                  "flex h-12 items-center justify-center rounded-2xl border transition-colors",
                  filled ? "border-flame bg-flame/10 text-flame" : "border-hair-bright text-dust",
                )}
              >
                {index === draft.participantIndex ? <Person className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>

        {/* ---------------------------------------------------------------- shots */}
        <div className="mt-7 border-t border-hair pt-6">
          <p className="marking">Shots per person</p>

          {/* The reference draws the shutter and the counter into one curved housing, so the
              number you are choosing sits on the camera it belongs to. */}
          <div className="mt-4 flex items-center justify-between rounded-b-[3rem] border border-t-0 border-hair-bright px-4 pt-2 pb-6">
            <Counter value={SHOT_TIERS[draft.shotIndex]} />
            <span className="h-[76px] w-[76px] rounded-full border-4 border-chalk bg-chalk/10" />
            <div className="flex w-24 justify-end">
              <Plate index={2} className="h-14 w-10 -rotate-8 rounded-lg ring-1 ring-void" />
              <Plate index={7} className="-ml-3 h-14 w-10 rotate-8 rounded-lg ring-1 ring-void" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2">
            {SHOT_TIERS.map((shots, index) => (
              <button
                key={shots}
                type="button"
                aria-pressed={index === draft.shotIndex}
                onClick={() => update({ shotIndex: index })}
                className={cn(
                  "tabular flex h-12 items-center justify-center rounded-2xl text-[15px] transition-colors",
                  index === draft.shotIndex
                    ? "border border-flame text-flame"
                    : "bg-surface text-chalk hover:text-flame",
                )}
              >
                {shots}
              </button>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------------- visibility */}
        <div className="mt-7 border-t border-hair pt-6">
          <p className="marking">Visibility permissions</p>
          <div className="mt-4">
            <Toggle
              on={draft.everyoneCanSee}
              onChange={(everyoneCanSee) => update({ everyoneCanSee })}
              labelOn="Everyone can see all photos."
              labelOff="Only host can see all photos."
            />
          </div>
        </div>
      </WizardShell>

      {/* ---------------------------------------------------------------- coupon */}
      <Dialog
        open={stage === "coupon"}
        title="Enter your coupon code"
        actions={
          <>
            <Pill variant="quiet" full onClick={() => setStage("form")}>
              Cancel
            </Pill>
            <Pill variant="flame" full disabled={!code.trim()} onClick={apply}>
              Apply
            </Pill>
          </>
        }
      >
        <p>
          MemoVue is invite-only while we&rsquo;re in beta. Enter the code you were given to
          create this roll.
        </p>
        <input
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setRejected(false);
          }}
          autoCapitalize="characters"
          placeholder="Your code"
          aria-label="Coupon code"
          className="mt-4 h-14 w-full rounded-2xl bg-void px-4 text-[16px] tracking-[0.08em] text-chalk uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
        />
        {rejected ? (
          <p className="mt-2 text-[13px] text-danger">
            That code isn&rsquo;t valid or has already been used.
          </p>
        ) : null}
      </Dialog>

      {/* --------------------------------------------------------------- created */}
      <Dialog
        open={stage === "created"}
        title="Roll Created!"
        actions={
          <Pill variant="quiet" full onClick={() => router.push("/proto/roll")}>
            OK
          </Pill>
        }
      >
        <p>Your roll &ldquo;{draft.title}&rdquo; is ready!</p>
        <p className="tabular mt-4">Share Code: {ROLL.code}</p>
        <p className="mt-4">Guests can join at:</p>
        <p className="break-all text-chalk">{ROLL.joinUrl}</p>
      </Dialog>
    </>
  );
}
