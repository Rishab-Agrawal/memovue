"use client";

import { useEffect } from "react";

/**
 * What every layer over the page owes the screen underneath it: that screen stops scrolling
 * away behind it, and Escape closes the layer.
 *
 * The lock goes on `<html>`, not `<body>` — that is the element that actually scrolls, and
 * iOS Safari ignores `overflow: hidden` on the body. Each layer restores whatever it found,
 * so a dialog opened over a sheet hands the lock back to the sheet rather than to the page.
 */
export function useOverlay(onClose?: () => void) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
