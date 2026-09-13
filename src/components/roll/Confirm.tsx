"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BackButton, Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";

/**
 * An in-app confirm, in place of `window.confirm`. A hook: call `confirm` with what to do on yes,
 * and render the returned `dialog` wherever you like.
 */
interface Question {
  title: string;
  /** The consequence, when it is worth spelling out. */
  body?: ReactNode;
  /** The word on the button that goes through with it. Never "OK" — say what happens. */
  action: string;
  /** Draws that button as a destruction rather than a choice. */
  danger?: boolean;
  onConfirm: () => void;
}

export function useConfirm(): [(question: Question) => void, ReactNode] {
  const [asking, setAsking] = useState<Question | null>(null);

  const dialog = (
    <Dialog
      open={asking !== null}
      title={asking?.title ?? ""}
      onClose={() => setAsking(null)}
      actions={
        <>
          <Pill variant="quiet" full onClick={() => setAsking(null)}>
            Cancel
          </Pill>
          <Pill
            full
            variant={asking?.danger ? "quiet" : "flame"}
            className={asking?.danger ? "bg-danger text-void hover:bg-danger" : undefined}
            onClick={() => {
              // Read before clearing, which unmounts the box.
              const go = asking?.onConfirm;
              setAsking(null);
              go?.();
            }}
          >
            {asking?.action ?? "Continue"}
          </Pill>
        </>
      }
    >
      {asking?.body}
    </Dialog>
  );

  return [setAsking, dialog];
}

/** Back out of an edit screen, confirming only when there are unsaved changes. */
export function EditBackButton({ href, dirty }: { href: string; dirty: boolean }) {
  const router = useRouter();
  const [confirm, dialog] = useConfirm();

  return (
    <>
      <BackButton
        href={href}
        onNavigate={(event) => {
          if (!dirty) return;
          event.preventDefault();
          confirm({
            title: "Discard your changes?",
            action: "Discard",
            danger: true,
            onConfirm: () => router.push(href),
          });
        }}
      />
      {dialog}
    </>
  );
}

/** The same box with one button, for a refusal there is nothing to decide about. */
export function useNotice(): [(message: string) => void, ReactNode] {
  const [message, setMessage] = useState<string | null>(null);

  const dialog = (
    <Dialog
      open={message !== null}
      title="That didn’t go through"
      onClose={() => setMessage(null)}
      actions={
        <Pill variant="quiet" full onClick={() => setMessage(null)}>
          OK
        </Pill>
      }
    >
      {message}
    </Dialog>
  );

  return [setMessage, dialog];
}
