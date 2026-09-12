"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";

import { BetaGate } from "@/components/roll/BetaGate";
import { Pill, StepButton } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { GiveawayHelp } from "@/components/roll/GiveawayHelp";
import { Google } from "@/components/roll/Icons";
import { ShareLink } from "@/components/roll/ShareLink";
import { Toggle } from "@/components/roll/Toggle";
import { WizardShell } from "@/components/roll/WizardShell";
import { uploadCover } from "@/lib/cover-upload";
import {
  BETA,
  GIVEAWAY_LABEL,
  GIVEAWAY_MIN_SHOTS,
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
  const { draft, update, hostName, signedIn, restored } = useDraft();
  const router = useRouter();

  /*
    The wall is on the home screen's button, not here — nobody should walk six steps to be
    told no. This is the second half of the same check: an allowance can be spent from
    another tab, or run out while somebody sits on this screen, and only the server knows.
  */
  const [blocked, setBlocked] = useState(false);
  /** The account, asked for once it buys something rather than on the way in. */
  const [needsAccount, setNeedsAccount] = useState(false);
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
    /*
      The first and only moment an account is needed: everything up to here is a draft in
      this tab. It survives the trip to Google in `sessionStorage`, and the sign-in lands
      back on this step, so the answer to the box is one tap and then Create.
    */
    if (!signedIn) {
      setNeedsAccount(true);
      return;
    }

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
      } else if (draft.coverPicked) {
        // Picked, but not here any more: a `Blob` does not survive the page that held it, so
        // a roll finished on the far side of a sign-in or a reload has the gradient and the
        // host has a photograph they think they chose.
        setCoverFailed(true);
      }

      // The roll exists, so the draft behind it has nothing left to protect.
      forgetDraft();
      setCreated({ id: result.rollId, code: result.code, name: result.name });
    });
  };

  /*
    Back from Google, on the roll they had already finished describing.

    Sending them to this screen and asking them to press Create a second time is asking twice
    for the same decision — they pressed it before they were interrupted. So the sign-in link
    carries `?create=1`, and landing on it with a draft finishes the job: the next thing they
    see is the roll's code and its link, which is what pressing Create was for.

    Waited on `restored`, because the draft arrives from `sessionStorage` an effect late and
    firing before it would post the blank defaults. Once, via the ref: this effect reruns on
    every keystroke of the transition it starts.
  */
  const autoCreated = useRef(false);
  useEffect(() => {
    if (autoCreated.current || !signedIn || !restored || !draft.name.trim()) return;
    // Read off the URL rather than `useSearchParams`, which would want a Suspense boundary
    // around a screen that is only ever rendered on demand anyway.
    if (new URLSearchParams(window.location.search).get("create") !== "1") return;
    autoCreated.current = true;
    // The rule is right in general and wrong here: arriving back from Google *is* the event,
    // and there is no earlier place to hear it. Guarded to fire once, so nothing cascades.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    create();
  });

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

          {/*
            Its own row under the same rule rather than its own section: both are one question
            about what a guest is allowed to do with somebody else's roll.

            Gone entirely on a roll too small to give film away on — see `GIVEAWAY_MIN_SHOTS`.
            The stepper above is right there, so a host who wants this can see it arrive.
          */}
          {SHOT_TIERS[draft.shotIndex] >= GIVEAWAY_MIN_SHOTS ? (
            <div className="mt-5 flex items-center gap-3">
              <Toggle
                on={draft.giveawayAllowed}
                onChange={(giveawayAllowed) => update({ giveawayAllowed })}
                labelOn={GIVEAWAY_LABEL.on}
                labelOff={GIVEAWAY_LABEL.off}
              />
              <GiveawayHelp shots={SHOT_TIERS[draft.shotIndex]} />
            </div>
          ) : null}
        </div>
      </WizardShell>

      <BetaGate open={blocked} onClose={() => setBlocked(false)} hostName={hostName} />

      <Dialog
        open={needsAccount}
        onClose={() => setNeedsAccount(false)}
        title="Almost there"
        actions={
          // A plain anchor for the same reason as the welcome screen's: this hands off to a
          // route handler that redirects to Google, and a client-side navigation has nowhere
          // to go. `next` brings them back to this step, with the draft still in the tab.
          <a
            href="/api/auth/google/start?next=/new/guests%3Fcreate=1"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-chalk px-6 text-[15px] font-medium whitespace-nowrap text-void transition-[color,background-color,scale] duration-150 hover:bg-white active:scale-[0.97]"
          >
            <Google className="h-5 w-5" />
            Continue with Google
          </a>
        }
      >
        <p>All set! Sign in to create your roll.</p>
      </Dialog>

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
