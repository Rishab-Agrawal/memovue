"use client";

import type { ReactNode } from "react";

import { useOverlay } from "@/lib/useOverlay";

/**
 * The reference's centred modal: a rounded card on a blurred scrim, with its actions as a
 * row of pills at the bottom. Used for the beta gate, roll-created, invalid-link, delete
 * confirmations and the QR-saved toast.
 */
export function Dialog({
  open,
  title,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
  /** Given, the scrim and Escape both dismiss. Omit for a box that must be answered. */
  onClose?: () => void;
}) {
  // Mounted only while open, so the hook below locks the page for exactly as long as the box
  // is on it.
  return open ? (
    <Panel title={title} actions={actions} onClose={onClose}>
      {children}
    </Panel>
  ) : null;
}

function Panel({
  title,
  children,
  actions,
  onClose,
}: {
  title: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
}) {
  useOverlay(onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      // Fixed, like `Sheet`: centred on the viewport, not on the document.
      className="animate-fade fixed inset-0 z-40 flex items-center justify-center bg-void/70 px-6 backdrop-blur-sm"
      // The scrim, not the card — a tap that lands on the box itself is not a dismissal.
      onClick={onClose && ((event) => event.target === event.currentTarget && onClose())}
    >
      {/*
        Capped and scrollable. The cover picker is taller than a small phone, and an
        uncapped card simply ran off both ends of the screen with its buttons on the far side.
      */}
      <div className="max-h-[85dvh] w-full max-w-[320px] overflow-y-auto rounded-3xl bg-surface p-6">
        <h2 className="display-sm text-[19px] text-chalk">{title}</h2>
        {children ? <div className="mt-3 text-[14px] leading-relaxed text-ash">{children}</div> : null}
        <div className="mt-6 flex gap-3">{actions}</div>
      </div>
    </div>
  );
}
