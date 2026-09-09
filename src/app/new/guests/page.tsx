"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";

import { BetaGate } from "@/components/roll/BetaGate";
import { Pill, StepButton } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { ShareLink } from "@/components/roll/ShareLink";
import { Toggle } from "@/components/roll/Toggle";
import { WizardShell } from "@/components/roll/WizardShell";
import { uploadCover } from "@/lib/cover-upload";
import {
  BETA,
  PARTICIPANT_TIERS,
  SHOT_TIERS,
  VISIBILITY_LABEL,
  formatPrice,
  priceFor,
  shotsAvailable,
} from "@/lib/roll-config";

import { createRollAction } from "../actions";
import { draftToInput, forgetDraft, useDraft } from "../DraftContext";

/**
 * The highest tier the stepper will climb to today.
 *
 * Read off `shotsAvailable` rather than hardcoded, and taken as the last index that passes
 * rather than a count of them, so it stays right if the tier that is held back ever stops
 * being the last one in the list.
 */
const SHOT_MAX = SHOT_TIERS.reduce((max, shots, index) => (shotsAvailable(shots) ? index : max), 0);

export default function StepGuests() {
  const { draft, update, hostName } = useDraft();
  const router = useRouter();

  /*
    The wall is on the home screen's button, not here — nobody should walk six steps to be
    told no. This is the second half of the same check: an allowance can be spent from
    another tab, or run out while somebody sits on this screen, and only the server knows.
  */
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string; name: string } | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const price = priceFor(draft.participantIndex, draft.shotIndex);
  // Only ever read after the roll exists, which is well past hydration.
  const joinLink =
    created && typeof window !== "undefined"
      ? `${window.location.origin}/join/${created.code}`
      : "";

  const create = () => {
    setError(null);
    startTransition(async () => {
      const result = await createRollAction(draftToInput(draft));
      if (!result.ok) {
        if (result.noAccess) setBlocked(true);
        else setError(result.error);
        return;
      }

      /*
        The cover goes up after the roll exists, because until this moment there was nothing
        to attach it to. A failure here is reported but not fatal: the allowance has been
        spent and the roll is real, so sending the host back to the wizard would cost them a
        roll over a picture they can set again from the roll's own settings in two taps.
      */
      if (draft.coverBlob) {
        try {
          await uploadCover(result.rollId, draft.coverBlob);
        } catch {
          setCoverFailed(true);
        }
      }

      // The roll exists, so the draft behind it has nothing left to protect.
      forgetDraft();
      setCreated({ id: result.rollId, code: result.code, name: result.name });
    });
  };

  return (
    <>
      <WizardShell
        step={5}
        title="How many guests for your roll?"
        back="/new/reveal"
        next={{
          label: pending ? "Creating…" : "Create →",
          href: "/new/guests",
          inert: !draft.name.trim() || pending,
        }}
        onNext={create}
      >
        {/*
          One drag across six tiers rather than six separate taps at six separate targets. A
          native range gives the keyboard and the screen reader their own way through it for
          nothing, which a row of buttons pretending to be one control never had.
        */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="marking">Up to</p>
            <p className="display tabular mt-1 text-[48px] text-chalk">
              {PARTICIPANT_TIERS[draft.participantIndex]}
            </p>
            <p className="mt-0.5 text-[14px] text-ash">participants</p>
          </div>
          <div className="shrink-0 text-right" data-testid="price">
            <p className={cn("text-[15px] text-dust", BETA && "line-through")}>
              {formatPrice(price)}
            </p>
            {BETA ? <p className="mt-0.5 text-[13px] text-flame">Free in beta</p> : null}
          </div>
        </div>

        <input
          type="range"
          className="film-slider mt-3"
          min={0}
          max={PARTICIPANT_TIERS.length - 1}
          step={1}
          value={draft.participantIndex}
          aria-label="Participant limit"
          aria-valuetext={`Up to ${PARTICIPANT_TIERS[draft.participantIndex]} participants`}
          onChange={(event) => update({ participantIndex: Number(event.target.value) })}
        />

        {/* `justify-between`, not six columns: a thumb travels between its own half-widths,
            so evenly-spaced column centres would sit off the ends it actually reaches. */}
        <div aria-hidden="true" className="flex justify-between px-0.5">
          {PARTICIPANT_TIERS.map((cap, index) => (
            <span
              key={cap}
              className={cn(
                "tabular text-[12px]",
                index === draft.participantIndex ? "text-flame" : "text-dust",
              )}
            >
              {cap}
            </span>
          ))}
        </div>

        <div className="mt-7 border-t border-hair pt-6">
          <p className="marking">Shots per person</p>

          {/*
            A stepper, not a second slider. The two numbers on this screen are chosen the same
            way if both are sliders, and the screen stops saying that they are different kinds
            of decision — the guest list is a range you sweep, the film is a count you land on.
          */}
          <div className="mt-5 flex items-center justify-center gap-8">
            <StepButton
              label="Fewer shots"
              glyph="−"
              disabled={draft.shotIndex === 0}
              onClick={() => update({ shotIndex: draft.shotIndex - 1 })}
            />

            <div className="text-center">
              <p
                aria-live="polite"
                className="display tabular text-[52px] leading-none text-chalk"
                data-testid="shots-tier"
              >
                {SHOT_TIERS[draft.shotIndex]}
              </p>
              <p className="marking mt-2">shots each</p>
            </div>

            <StepButton
              label="More shots"
              glyph="+"
              disabled={draft.shotIndex >= SHOT_MAX}
              onClick={() => update({ shotIndex: draft.shotIndex + 1 })}
            />
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

      <BetaGate open={blocked} onClose={() => setBlocked(false)} hostName={hostName} />

      <Dialog
        open={error !== null}
        onClose={() => setError(null)}
        title="That didn't go through"
        actions={
          <Pill variant="quiet" full onClick={() => setError(null)}>
            OK
          </Pill>
        }
      >
        <p>{error}</p>
      </Dialog>

      <Dialog
        open={created !== null}
        onClose={() => router.push(`/rolls/${created?.id}`)}
        title="Roll Created!"
        actions={
          <>
            {/* The link was printed and nothing could pick it up. This is the same control
                the invite sheet uses — the phone's own share sheet, clipboard behind it. */}
            <ShareLink url={joinLink} />
            <Pill variant="quiet" full onClick={() => router.push(`/rolls/${created?.id}`)}>
              OK
            </Pill>
          </>
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
