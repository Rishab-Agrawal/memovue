"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * One line of transient text, so no control declines silently. A hook: call `say`, and render
 * the returned `toast` wherever you like.
 */
export function useToast(): [(message: string) => void, ReactNode] {
  const [message, setMessage] = useState<string | null>(null);

  // Long enough to read, including the refusal that carries an email address.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), Math.max(2600, message.length * 70));
    return () => clearTimeout(timer);
  }, [message]);

  const toast = message ? (
    <p
      role="status"
      className="animate-fade pointer-events-none fixed top-1/2 left-1/2 z-50 max-w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface/95 px-5 py-3.5 text-center text-[14px] leading-snug text-chalk shadow-[0_8px_40px_-8px_rgba(0,0,0,0.9)] backdrop-blur-sm"
    >
      {message}
    </p>
  ) : null;

  return [setMessage, toast];
}
