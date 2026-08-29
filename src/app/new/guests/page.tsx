"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";

import { Pill } from "@/components/roll/Chrome";
import { Counter } from "@/components/roll/Counter";
import { Dialog } from "@/components/roll/Dialog";
import { Person } from "@/components/roll/Icons";
import { Plate } from "@/components/roll/Plate";
import { FRAMES } from "@/lib/imagery";
import { Toggle } from "@/components/roll/Toggle";
import { WizardShell } from "@/components/roll/WizardShell";
import { uploadCover } from "@/lib/cover-upload";
import {
  PARTICIPANT_TIERS,
  SHOT_TIERS,
  VISIBILITY_LABEL,
  formatPrice,
  priceFor,
} from "@/lib/roll-config";

import { createRollAction } from "../actions";
import { draftToInput, useDraft } from "../DraftContext";

type Stage = "form" | "coupon" | "created";

export default function StepGuests() {
  const { draft, update } = useDraft();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("form");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string; name: string } | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const price = priceFor(draft.participantIndex, draft.shotIndex);

  const apply = () => {
    setError(null);
    startTransition(async () => {
      const result = await createRollAction(draftToInput(draft, code));
      if (!result.ok) {
        setError(result.error);
        return;
      }

      /*
        The cover goes up after the roll exists, because until this moment there was nothing
        to attach it to. A failure here is reported but not fatal: the coupon has been spent
        and the roll is real, so sending the host back to the wizard would cost them a code
        over a picture they can set again from the roll's own settings in two taps.
      */
      if (draft.coverBlob) {
        try {
          await uploadCover(result.rollId, draft.coverBlob);
        } catch {
          setCoverFailed(true);
        }
      }

      setCreated({ id: result.rollId, code: result.code, name: result.name });
      setStage("created");
    });
  };

  return (
    <>
      <WizardShell
        step={6}
        title="How many guests for your roll?"
        subtitle="Make sure all guests have a chance to take the most amazing photo from your event."
        back="/new/card"
        next={{ label: "Create →", href: "/new/guests", inert: !draft.name.trim() }}
        onNext={() => setStage("coupon")}
      >
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

        <div className="mt-7 border-t border-hair pt-6">
          <p className="marking">Shots per person</p>

          <div className="mt-4 flex items-center justify-between rounded-b-[3rem] border border-t-0 border-hair-bright px-4 pt-2 pb-6">
            <Counter value={SHOT_TIERS[draft.shotIndex]} />
            <span className="h-[76px] w-[76px] rounded-full border-4 border-chalk bg-chalk/10" />
            <div className="flex w-24 justify-end">
              <Plate photo={FRAMES[2]} className="h-14 w-10 -rotate-8 rounded-lg ring-1 ring-void" />
              <Plate photo={FRAMES[3]} className="-ml-3 h-14 w-10 rotate-8 rounded-lg ring-1 ring-void" />
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

        <div className="mt-7 border-t border-hair pt-6">
          <p className="marking">Visibility permissions</p>
          <div className="mt-4">
            <Toggle
              on={draft.everyoneCanSee}
              onChange={(everyoneCanSee) => update({ everyoneCanSee })}
              labelOn={VISIBILITY_LABEL.on}
              labelOff={VISIBILITY_LABEL.off}
            />
          </div>
        </div>
      </WizardShell>

      <Dialog
        open={stage === "coupon"}
        title="Enter your coupon code"
        actions={
          <>
            <Pill variant="quiet" full disabled={pending} onClick={() => setStage("form")}>
              Cancel
            </Pill>
            <Pill variant="flame" full disabled={!code.trim() || pending} onClick={apply}>
              {pending ? "Checking…" : "Apply"}
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
            setError(null);
          }}
          autoCapitalize="characters"
          placeholder="Your code"
          aria-label="Coupon code"
          className="mt-4 h-14 w-full rounded-2xl bg-void px-4 text-[16px] tracking-[0.08em] text-chalk uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
        />
        {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
      </Dialog>

      <Dialog
        open={stage === "created"}
        title="Roll Created!"
        actions={
          <Pill variant="quiet" full onClick={() => router.push(`/rolls/${created?.id}`)}>
            OK
          </Pill>
        }
      >
        <p>Your roll &ldquo;{created?.name}&rdquo; is ready!</p>
        <p className="tabular mt-4">Share Code: {created?.code}</p>
        <p className="mt-4">Guests can join at:</p>
        <p className="break-all text-chalk">
          {typeof window === "undefined" ? "" : window.location.origin}/join/{created?.code}
        </p>

        {coverFailed ? (
          <p className="mt-4 text-danger">
            Your cover photo didn&rsquo;t upload. The roll is using a preset — you can set the
            photo again from its settings.
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
