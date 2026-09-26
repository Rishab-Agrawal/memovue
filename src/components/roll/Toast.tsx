"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * One line of transient text, so no control declines silently. A hook: call `say`, and render
 * the returned `toast` wherever you like. `loud` is for a refusal that must not be missed.
 */
export function useToast(): [(message: string, loud?: boolean) => void, ReactNode] {
  const [message, setMessage] = useState<string | null>(null);
  const [loud, setLoud] = useState(false);

  // Long enough to read, including the refusal that carries an email address.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), Math.max(2600, message.length * 70));
    return () => clearTimeout(timer);
  }, [message]);

  const toast = message ? (
    <p
      role="status"
      className={cn(
        "animate-fade pointer-events-none fixed top-1/2 left-1/2 z-50 max-w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl px-5 py-3.5 text-center text-[14px] leading-snug shadow-[0_8px_40px_-8px_rgba(0,0,0,0.9)] backdrop-blur-sm",
        loud ? "bg-flame font-medium text-void" : "bg-surface/95 text-chalk",
      )}
    >
      {message}
    </p>
  ) : null;

  const say = (next: string, isLoud = false) => {
    setMessage(next);
    setLoud(isLoud);
  };

  return [say, toast];
}
