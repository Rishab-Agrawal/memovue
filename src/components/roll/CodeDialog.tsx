"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { requestCodeAction } from "@/app/actions";
import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { useToast } from "@/components/roll/Toast";
import { Honeypot, useFormAge } from "@/components/ui/Honeypot";

/**
 * The referral code every roll is created with, asked for at the wizard's Create button.
 *
 * Asking for one takes an address and nothing else. With an account that address is already
 * known, so asking is one tap; without one, a second screen asks for it. Either way the wizard
 * has nothing left to offer them, so once the confirmation has been read they go back to where
 * they started it.
 */

/** How long the confirmation shows before leaving the wizard, which takes it down with it. */
const CONFIRM_MS = 2_000;

/** Enough to catch a typo before the server does. The server's check is the real one. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field =
  "mt-1.5 h-12 w-full rounded-2xl bg-void px-4 text-[15px] text-chalk " +
  "placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame";

export function CodeDialog({
  open,
  onClose,
  code,
  onCodeChange,
  error,
  pending,
  signedIn,
  onSubmit,
  hostEmail,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  onCodeChange: (code: string) => void;
  /** Shown under the box: a code that names nobody, or one already used. */
  error: string | null;
  pending: boolean;
  /** Without an account, the button signs in first and the roll is created on the way back. */
  signedIn: boolean;
  onSubmit: () => void;
  /** The account's address. Empty without one, and then it is typed. */
  hostEmail: string;
}) {
  const [asking, setAsking] = useState(false);
  const [email, setEmail] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [sending, startTransition] = useTransition();
  const [say, toast] = useToast();
  const router = useRouter();

  const [trap, setTrap] = useState("");
  // Counted from the wizard's last step appearing, which only ever makes the span longer.
  const formAge = useFormAge();

  const close = () => {
    setAsking(false);
    setRequestError(null);
    onClose();
  };

  const request = (address: string) => {
    setRequestError(null);
    startTransition(async () => {
      const result = await requestCodeAction({ email: address, trap, elapsedMs: formAge() });
      if (!result.ok) {
        setRequestError(result.error);
        return;
      }
      close();
      say("Request submitted!", true);
      // Home with an account, the welcome screen without: `/rolls` sends a stranger there.
      setTimeout(() => router.push("/rolls"), CONFIRM_MS);
    });
  };

  const ready = code.trim() !== "" && !pending;

  return (
    <>
      <Dialog
        open={open && !asking}
        onClose={pending ? undefined : close}
        title="Enter your referral code"
        actions={
          <>
            <Pill variant="quiet" className="px-5" disabled={pending} onClick={close}>
              Cancel
            </Pill>
            <Pill variant="flame" full className="px-4" disabled={!ready} onClick={onSubmit}>
              {pending ? "Checking…" : signedIn ? "Create roll" : "Sign in and create"}
            </Pill>
          </>
        }
      >
        <input
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && ready && onSubmit()}
          type="text"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Referral code"
          aria-invalid={error ? "true" : undefined}
          className={`${field} tracking-[0.06em] uppercase`}
        />
        {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}

        <button
          type="button"
          disabled={sending}
          onClick={() => (hostEmail ? request(hostEmail) : setAsking(true))}
          className="mt-4 text-[14px] text-chalk underline underline-offset-4 transition-colors hover:text-flame disabled:opacity-40"
        >
          {sending ? "Sending…" : "Don’t have one? Request a code"}
        </button>
        {requestError ? <p className="mt-2 text-[13px] text-danger">{requestError}</p> : null}

        <Honeypot value={trap} onChange={setTrap} />
      </Dialog>

      <Dialog
        open={open && asking}
        onClose={close}
        title="Request a referral code"
        actions={
          <>
            <Pill variant="quiet" full disabled={sending} onClick={() => setAsking(false)}>
              Back
            </Pill>
            <Pill
              variant="flame"
              full
              disabled={sending || !EMAIL_SHAPE.test(email.trim())}
              onClick={() => request(email.trim())}
            >
              {sending ? "Sending…" : "Submit"}
            </Pill>
          </>
        }
      >
        <p>We&rsquo;ll email you a code.</p>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) =>
            event.key === "Enter" && EMAIL_SHAPE.test(email.trim()) && request(email.trim())
          }
          type="email"
          inputMode="email"
          autoFocus
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          aria-label="Email"
          className={`${field} mt-4`}
        />

        <Honeypot value={trap} onChange={setTrap} />

        {requestError ? <p className="mt-2 text-[13px] text-danger">{requestError}</p> : null}
      </Dialog>

      {toast}
    </>
  );
}
