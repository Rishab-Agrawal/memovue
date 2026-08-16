"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { BackButton } from "@/components/roll/Chrome";
import { Counter } from "@/components/roll/Counter";
import { FlashOff, Flip, Qr } from "@/components/roll/Icons";
import { Plate } from "@/components/roll/Plate";
import { ROLL, NOW, SHOTS_PER_PERSON } from "@/lib/mock-REMOVED";
import { formatCountdown } from "@/lib/format";

type Phase = "idle" | "flash" | "hold" | "fly";

const FLASH_MS = 90;
const HOLD_MS = 700;
const FLIGHT_MS = 420;

/**
 * The camera.
 *
 * There is no keep/retake step: the reference has none, and neither do we. Tapping the
 * shutter spends a shot, holds the frame for a beat so you see what you got, then throws it
 * into the gallery thumbnail. That throw is the only confirmation, and it is what makes the
 * count on the dial feel like it cost something.
 *
 * The flight is measured rather than guessed — the frame and the thumbnail report their own
 * boxes, so the photo lands on the thumbnail at any screen size instead of near it.
 */
export function CameraScreen({ autoCapture }: { autoCapture?: boolean }) {
  // Explicitly `number`: SHOT_TIERS is `as const`, so the inferred type would be the literal
  // union of the six tiers and decrementing it would not typecheck.
  const [shotsLeft, setShotsLeft] = useState<number>(SHOTS_PER_PERSON);
  const [phase, setPhase] = useState<Phase>("idle");
  const [flight, setFlight] = useState<{ x: number; y: number; scale: number } | null>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLAnchorElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const capture = useCallback(() => {
    if (phase !== "idle" || shotsLeft === 0) return;

    const spend = () => setShotsLeft((left) => Math.max(0, left - 1));

    // Travel and scale are what cause vestibular trouble, so reduced motion skips the
    // flight entirely rather than playing it faster.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      spend();
      return;
    }

    const frame = frameRef.current?.getBoundingClientRect();
    const thumb = thumbRef.current?.getBoundingClientRect();
    if (frame && thumb) {
      setFlight({
        x: thumb.left + thumb.width / 2 - (frame.left + frame.width / 2),
        y: thumb.top + thumb.height / 2 - (frame.top + frame.height / 2),
        scale: thumb.width / frame.width,
      });
    }

    setPhase("flash");
    timers.current.push(
      setTimeout(() => setPhase("hold"), FLASH_MS),
      setTimeout(() => setPhase("fly"), HOLD_MS),
      setTimeout(() => {
        setPhase("idle");
        setFlight(null);
        spend();
      }, HOLD_MS + FLIGHT_MS),
    );
  }, [phase, shotsLeft]);

  // `?v=captured` exists so the animation is reachable from the screen index rather than
  // only by tapping.
  const fired = useRef(false);
  useEffect(() => {
    if (!autoCapture || fired.current) return;
    fired.current = true;
    const timer = setTimeout(capture, 400);
    return () => clearTimeout(timer);
  }, [autoCapture, capture]);

  const flying = phase === "hold" || phase === "fly";

  return (
    // PAGE rather than VOID so the counter's pure-black housing has something to sit against.
    <div className="flex h-full flex-col bg-page">
      <header className="flex items-center justify-between gap-3 px-4 pt-4">
        <BackButton href="/proto/guest" />
        <div className="min-w-0 text-center">
          <p className="display-sm truncate text-[19px] text-chalk">{ROLL.title}</p>
          <p className="tabular text-[13px] text-dust">
            {formatCountdown(ROLL.finishAt.getTime() - NOW.getTime())}
          </p>
        </div>
        <Link
          href="/proto/guest/camera/invite"
          aria-label="Invite guests"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-chalk transition-colors hover:text-flame"
        >
          <Qr className="h-5 w-5" />
        </Link>
      </header>

      {/* --------------------------------------------------------------- viewfinder */}
      <div className="flex flex-1 items-center px-4 py-4">
        <div ref={frameRef} className="relative aspect-[4/5] w-full">
          <Plate index={6} className="absolute inset-0 rounded-[2rem]" />

          {phase === "flash" ? (
            <span className="absolute inset-0 rounded-[2rem] bg-white" />
          ) : null}

          {flying ? (
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
              style={{
                transition: `transform ${FLIGHT_MS}ms var(--ease-out-soft), opacity ${FLIGHT_MS}ms ease`,
                transform:
                  phase === "fly" && flight
                    ? `translate(${flight.x}px, ${flight.y}px) scale(${flight.scale})`
                    : "none",
                opacity: phase === "fly" ? 0.15 : 1,
              }}
            >
              <Plate index={6} className="absolute inset-0" />
            </div>
          ) : null}
        </div>
      </div>

      {/* ----------------------------------------------------------------- controls */}
      <div className="flex items-center justify-between px-8">
        <button type="button" aria-label="Flash off" className="tap text-chalk">
          <FlashOff className="h-6 w-6" />
        </button>

        <div className="flex items-center rounded-full bg-page p-1">
          {["1x", "2x"].map((zoom, index) => (
            <button
              key={zoom}
              type="button"
              className={cn(
                "tabular h-9 w-12 rounded-full text-[14px] transition-colors",
                index === 0 ? "bg-surface text-chalk" : "text-dust",
              )}
            >
              {zoom}
            </button>
          ))}
        </div>

        <button type="button" aria-label="Flip camera" className="tap text-chalk">
          <Flip className="h-6 w-6" />
        </button>
      </div>

      {/* ------------------------------------------------------------------- shutter */}
      <div className="flex items-center justify-between px-6 pt-6 pb-8">
        <Counter value={shotsLeft} />

        <button
          type="button"
          aria-label="Take photo"
          onClick={capture}
          disabled={shotsLeft === 0}
          className="h-[88px] w-[88px] rounded-full border-4 border-chalk bg-surface transition-transform active:scale-95 disabled:opacity-40"
        />

        <Link
          ref={thumbRef}
          href="/proto/guest/album"
          aria-label="Open album"
          className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-2xl bg-surface"
        >
          <Plate index={1} className="h-full w-full" />
        </Link>
      </div>
    </div>
  );
}
