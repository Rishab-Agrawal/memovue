import type { ReactNode } from "react";

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
}: {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      // Fixed for the same reason as `Sheet`: centred on the viewport, not on the document.
      className="animate-fade fixed inset-0 z-40 flex items-center justify-center bg-void/70 px-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-[320px] rounded-3xl bg-surface p-6">
        <h2 className="display-sm text-[19px] text-chalk">{title}</h2>
        {children ? <div className="mt-3 text-[14px] leading-relaxed text-ash">{children}</div> : null}
        <div className="mt-6 flex gap-3">{actions}</div>
      </div>
    </div>
  );
}
