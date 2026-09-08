"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BackButton, Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";

/**
 * The one question this product ever stops to ask, drawn the way the rest of it is.
 *
 * There were eight `window.confirm` calls scattered across the wizard, the settings forms and
 * the photo viewer — the only chrome in MemoVue drawn by somebody else. A native confirm uses
 * the system font, the system buttons and the browser's own words for Cancel, so the moment a
 * host is asked whether to throw away five steps of work is the moment the app stops looking
 * like itself. It also cannot say which of the two answers is the destructive one.
 *
 * A hook rather than a component because `window.confirm` was synchronous and these are not:
 * the caller keeps its handler and hands over what to do if the answer is yes, and renders
 * `dialog` wherever it likes. Two of the call sites are `onNavigate` handlers that cancel a
 * link and re-issue it on confirmation, which is exactly this shape.
 */
export interface Question {
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
              // Read before closing: clearing the question is what unmounts the box, and the
              // callback belongs to the question rather than to the box.
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

/**
 * Backing out of an edit screen that has unsaved changes.
 *
 * All four settings forms asked the same question in the same place with the same words, and
 * a fifth would have copied it again. The link stays a real link — a clean form leaves without
 * a word, and a modifier-click still opens the settings sheet in a new tab.
 */
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
