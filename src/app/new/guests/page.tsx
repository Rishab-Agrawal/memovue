"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";

import { BetaGate } from "@/components/roll/BetaGate";
import { Pill } from "@/components/roll/Chrome";
import { Counter } from "@/components/roll/Counter";
import { Dialog } from "@/components/roll/Dialog";
import { Person } from "@/components/roll/Icons";
import { Plate } from "@/components/roll/Plate";
import { ShareLink } from "@/components/roll/ShareLink";
import { FRAMES } from "@/lib/imagery";
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
        step={6}
        title="How many guests for your roll?"
        subtitle="Make sure all guests have a chance to take the most amazing photo from your event."
        back="/new/card"
        next={{
          label: pending ? "Creating…" : "Create →",
          href: "/new/guests",
          inert: !draft.name.trim() || pending,
        }}
        onNext={create}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="display-md text-[26px] text-chalk">
            Up to
            <br />
            {PARTICIPANT_TIERS[draft.participantIndex]} Participants
          </p>
          <div className="shrink-0 pt-2 text-right" data-testid="price">
            <p className={cn("text-[15px] text-dust", BETA && "line-through")}>
              {formatPrice(price)}
            </p>
            {BETA ? <p className="mt-0.5 text-[13px] text-flame">Free in beta</p> : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-6 gap-1.5">
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
            {SHOT_TIERS.map((shots, index) => {
              const locked = !shotsAvailable(shots);
              return (
                <button
                  key={shots}
                  type="button"
                  disabled={locked}
                  aria-pressed={index === draft.shotIndex}
                  aria-label={locked ? `${shots} shots, not available in beta` : `${shots} shots`}
                  onClick={() => update({ shotIndex: index })}
                  className={cn(
                    "tabular flex h-12 items-center justify-center rounded-2xl text-[15px] transition-colors",
                    locked
                      ? "bg-surface text-dust/40 line-through"
                      : index === draft.shotIndex
                        ? "border border-flame text-flame"
                        : "bg-surface text-chalk hover:text-flame",
                  )}
                >
                  {shots}
                </button>
              );
            })}
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
            <ShareLink url={joinLink} rollName={created?.name ?? ""} />
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
