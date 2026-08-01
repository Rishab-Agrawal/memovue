"use client";

import { useFormStatus } from "react-dom";

import { Button } from "./Button";

/**
 * Reads the enclosing form's pending state, so every form gets a disabled/"working"
 * button without threading state through by hand.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: { children: React.ReactNode; pendingLabel?: string } & Omit<
  React.ComponentProps<typeof Button>,
  "type"
>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}
