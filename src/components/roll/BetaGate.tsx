"use client";

import { useEffect, useState, useTransition } from "react";

import { requestBetaAccessAction } from "@/app/actions";
import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Honeypot, useFormAge } from "@/components/ui/Honeypot";

/**
 * What somebody without beta access sees when they try to make a roll.
 *
 * Two screens in one component, because they are one conversation: you cannot do this, and
 * here is how to ask. Splitting them would mean a second dialog that only ever opens from
 * the first, and a person tapping twice to reach a form they were always going to be shown.
 *
 * Mounted by whoever can refuse — the home screen's button, and the wizard's last step, which
 * only finds out when the server refuses the write. The snackbar lives here rather than in
 * either parent so the confirmation survives the dialog closing.
 */

/** How long the confirmation sits at the bottom of the screen before it leaves. */
const SNACKBAR_MS = 4_000;

const field =
  "mt-1.5 h-12 w-full rounded-2xl bg-void px-4 text-[15px] text-chalk " +
  "placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame";

export function BetaGate({
  open,
  onClose,
  hostName,
}: {
  open: boolean;
  onClose: () => void;
  /** Prefills the form. They already told us their name when they signed in. */
  hostName: string;
}) {
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState(hostName);
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const [trap, setTrap] = useState("");
  // Counted from this dialog appearing rather than from the Request tap inside it, which only
  // ever makes the span longer. The floor is a floor; nothing here needs it to be tight.
  const formAge = useFormAge();

  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [sent]);

  const close = () => {
    setAsking(false);
    setError(null);
    onClose();
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestBetaAccessAction({
        name,
        phone: phone.trim() || undefined,
        eventType,
        remarks: remarks.trim() || undefined,
        trap,
        elapsedMs: formAge(),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSent(true);
      close();
    });
  };

  return (
    <>
      <Dialog
        open={open && !asking}
        onClose={close}
        title="You've used your first roll"
        actions={
          <>
            <Pill variant="quiet" full onClick={close}>
              Not now
            </Pill>
            <Pill variant="flame" full onClick={() => setAsking(true)}>
              Request
            </Pill>
          </>
        }
      >
        <p>
          Every account gets one roll on us, and beyond that MemoVue is invite-only while
          we&rsquo;re in beta. Tell us about your event and we&rsquo;ll open up more for this
          account.
        </p>
      </Dialog>

      <Dialog
        open={open && asking}
        onClose={close}
        title="Request beta access"
        actions={
          <>
            <Pill variant="quiet" full disabled={pending} onClick={close}>
              Cancel
            </Pill>
            <Pill
              variant="flame"
              full
              disabled={pending || !name.trim() || !eventType.trim()}
              onClick={submit}
            >
              {pending ? "Sending…" : "Submit"}
            </Pill>
          </>
        }
      >
        <label className="block">
          <span className="marking">Your name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Your name"
            className={field}
          />
        </label>

        <label className="mt-3 block">
          <span className="marking">Phone (optional)</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            aria-label="Phone number"
            className={field}
          />
        </label>

        <label className="mt-3 block">
          <span className="marking">Event type</span>
          <input
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            placeholder="Wedding, birthday, offsite…"
            aria-label="Event type"
            className={field}
          />
        </label>

        <label className="mt-3 block">
          <span className="marking">Remarks (optional)</span>
          <textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows={3}
            aria-label="Remarks"
            className={`${field} h-auto py-3 leading-relaxed`}
          />
        </label>

        <Honeypot value={trap} onChange={setTrap} />

        {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
      </Dialog>

      {sent ? (
        <div
          role="status"
          className="animate-fade fixed inset-x-0 bottom-6 z-50 flex justify-center px-6"
        >
          <p className="rounded-full bg-chalk px-5 py-3 text-[14px] text-void shadow-lg">
            Beta access request sent
          </p>
        </div>
      ) : null}
    </>
  );
}
