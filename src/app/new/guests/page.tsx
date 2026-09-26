"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";

import { Pill, StepButton } from "@/components/roll/Chrome";
import { CodeDialog } from "@/components/roll/CodeDialog";
import { Dialog } from "@/components/roll/Dialog";
import { GiveawayHelp } from "@/components/roll/GiveawayHelp";
import { ShareLink } from "@/components/roll/ShareLink";
import { Toggle } from "@/components/roll/Toggle";
import { WizardShell } from "@/components/roll/WizardShell";
import { uploadCover } from "@/lib/cover-upload";
import {
  GIVEAWAY_LABEL,
  GIVEAWAY_MIN_SHOTS,
  PARTICIPANT_TIERS,
  SHOTS_POOL,
  SHOT_TIERS,
  VISIBILITY_LABEL,
  formatPrice,
  priceFor,
  shotsAvailable,
} from "@/lib/roll-config";

import { checkReferralAction, createRollAction } from "../actions";
import { draftToInput, forgetDraft, useDraft } from "../DraftContext";

/** The highest shot tier the stepper may reach today: the last index `shotsAvailable` allows. */
const SHOT_MAX = SHOT_TIERS.reduce((max, shots, index) => (shotsAvailable(shots) ? index : max), 0);

export default function StepGuests() {
  const { draft, update, hostEmail, signedIn, restored } = useDraft();
  const router = useRouter();

  const [asking, setAsking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
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
    setCodeError(null);
    startTransition(async () => {
      const result = await createRollAction(draftToInput(draft));
      if (!result.ok) {
        // A code error belongs under the box, which is opened for it on the way back from Google.
        if (result.fields?.referralCode) {
          setCodeError(result.fields.referralCode);
          setAsking(true);
        } else {
          setAsking(false);
          setError(result.error);
        }
        return;
      }
      setAsking(false);

      // The cover goes up once the roll exists. A failure is reported, not fatal: it can be set again in settings.
      if (draft.coverBlob) {
        try {
          await uploadCover(result.rollId, draft.coverBlob);
        } catch {
          setCoverFailed(true);
        }
      } else if (draft.coverPicked) {
        // Picked but lost to a reload or sign-in: the blob does not survive the page.
        setCoverFailed(true);
      }

      forgetDraft();
      setCreated({ id: result.rollId, code: result.code, name: result.name });
    });
  };

  /**
   * The only moment an account is needed. The code is checked first, so a typo does not cost a
   * trip to Google; the draft, code included, survives the trip.
   */
  const signInAndCreate = () => {
    setCodeError(null);
    startTransition(async () => {
      const result = await checkReferralAction({ code: draft.referralCode });
      if (!result.ok) {
        setCodeError(result.error);
        return;
      }
      window.location.assign("/api/auth/google/start?next=/new/guests%3Fcreate=1");
    });
  };

  /*
    Back from Google with `?create=1`: they already pressed Create, so finish the job. Waits for
    the draft to be restored, and fires once via the ref.
  */
  const autoCreated = useRef(false);
  useEffect(() => {
    if (autoCreated.current || !signedIn || !restored || !draft.name.trim()) return;
    // Off the URL rather than `useSearchParams`, which would need a Suspense boundary.
    if (new URLSearchParams(window.location.search).get("create") !== "1") return;
    autoCreated.current = true;
    // Returning from Google is the event itself, and this fires once.
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
        onNext={() => setAsking(true)}
      >
        {/* A native range: one drag across the tiers, with keyboard and screen-reader support built in. */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="marking">Up to</p>
            <p className="display tabular mt-1 text-[48px] text-chalk">
              {PARTICIPANT_TIERS[draft.participantIndex]}
            </p>
            <p className="mt-0.5 text-[14px] text-ash">participants</p>
          </div>
          <p className="shrink-0 text-right text-[15px] text-dust" data-testid="price">
            {formatPrice(price)}
          </p>
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

          {/* Hidden below `GIVEAWAY_MIN_SHOTS`. */}
          {SHOTS_POOL && SHOT_TIERS[draft.shotIndex] >= GIVEAWAY_MIN_SHOTS ? (
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

      <CodeDialog
        open={asking}
        onClose={() => setAsking(false)}
        code={draft.referralCode}
        onCodeChange={(referralCode) => {
          update({ referralCode });
          setCodeError(null);
        }}
        error={codeError}
        pending={pending}
        signedIn={signedIn}
        onSubmit={signedIn ? create : signInAndCreate}
        hostEmail={hostEmail}
      />

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
