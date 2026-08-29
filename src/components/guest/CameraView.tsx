"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { type ProcessedPhoto, processCapture } from "@/lib/image";

import { Counter } from "@/components/roll/Counter";
import { FlashOff, Flip } from "@/components/roll/Icons";

type Facing = "environment" | "user";
type Permission = "idle" | "starting" | "live" | "denied" | "unsupported";
type Phase = "idle" | "flash" | "hold" | "fly";

const FLASH_MS = 55;
const HOLD_MS = 600;
const FLIGHT_MS = 420;

interface CameraViewProps {
  shotsLeft: number;
  disabled?: boolean;
  inert?: boolean;
  onCaptured: (photo: ProcessedPhoto) => void;
  onOpenAlbum: () => void;
  latestThumb?: string | null;
}

/**
 * The viewfinder.
 *
 * Two things it does that a naive implementation gets wrong. The frame is cropped to what
 * was actually on screen — the sensor is wider than the viewport, and handing someone a
 * photo containing things that were never in their viewfinder feels broken. And there is no
 * keep/retake step: the shutter spends a shot, holds the frame for a beat, then throws it
 * into the gallery thumbnail. That throw is the only confirmation, which is what makes the
 * number on the dial feel like it cost something.
 */
export function CameraView({
  shotsLeft,
  disabled,
  inert,
  onCaptured,
  onOpenAlbum,
  latestThumb,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [facing, setFacing] = useState<Facing>("environment");
  const [permission, setPermission] = useState<Permission>("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [frozen, setFrozen] = useState<string | null>(null);
  const [flight, setFlight] = useState<{ x: number; y: number; scale: number } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermission("unsupported");
        return;
      }
      setPermission("starting");
      stop();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 2560 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
        setHasTorch(Boolean(capabilities?.torch));
        setTorchOn(false);
        setPermission("live");
      } catch {
        if (!cancelled) setPermission("denied");
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      // `torch` is a real constraint on Android Chrome but isn't in the DOM typings yet.
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }

  function runFlight(preview: string) {
    const frame = frameRef.current?.getBoundingClientRect();
    const thumb = thumbRef.current?.getBoundingClientRect();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !frame || !thumb) {
      setFrozen(null);
      setPhase("idle");
      return;
    }

    setFlight({
      x: thumb.left + thumb.width / 2 - (frame.left + frame.width / 2),
      y: thumb.top + thumb.height / 2 - (frame.top + frame.height / 2),
      scale: thumb.width / frame.width,
    });
    setFrozen(preview);
    setPhase("hold");

    timers.current.push(
      setTimeout(() => setPhase("fly"), HOLD_MS),
      setTimeout(() => {
        setPhase("idle");
        setFrozen(null);
        setFlight(null);
      }, HOLD_MS + FLIGHT_MS),
    );
  }

  async function capture() {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || phase !== "idle" || disabled || shotsLeft <= 0) return;

    setPhase("flash");
    navigator.vibrate?.(12);

    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = frame.clientWidth;
      const ch = frame.clientHeight;

      // Mirror of CSS `object-fit: cover` — work out which slice of the sensor was actually
      // on screen, and keep only that.
      const scale = Math.max(cw / vw, ch / vh);
      const sw = Math.min(vw, cw / scale);
      const sh = Math.min(vh, ch / scale);

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");

      if (facing === "user") {
        // The preview is mirrored, so the saved frame is too — otherwise the photo you get
        // is not the one you framed.
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);

      const processed = await processCapture(canvas);
      onCaptured(processed);

      timers.current.push(
        setTimeout(() => runFlight(canvas.toDataURL("image/jpeg", 0.6)), FLASH_MS),
      );
    } catch {
      setPhase("idle");
    }
  }

  const out = shotsLeft <= 0;
  const flying = phase === "hold" || phase === "fly";

  return (
    <div inert={inert} className="flex h-full flex-col bg-page">
      <div className="flex flex-1 items-center px-4 py-4">
        <div ref={frameRef} className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] bg-void">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={cn(
              "h-full w-full object-cover",
              facing === "user" && "-scale-x-100",
              permission !== "live" && "opacity-0",
            )}
          />

          {permission === "denied" || permission === "unsupported" ? (
            <div className="absolute inset-0 grid place-items-center px-8 text-center">
              <div>
                <p className="text-[15px] leading-relaxed text-ash">
                  {permission === "unsupported"
                    ? "This browser can't open the camera."
                    : "MemoVue needs camera access to take photos."}
                </p>
              </div>
            </div>
          ) : null}

          {/* Black, not white. The frame going dark reads as a shutter closing; a white
              wash reads as a camera-app screen flash, which is the cheap version. */}
          {phase === "flash" ? <span className="absolute inset-0 bg-void" /> : null}

          {flying && frozen ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={frozen}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full rounded-[2rem] object-cover"
              style={{
                transition: `transform ${FLIGHT_MS}ms var(--ease-out-soft), opacity ${FLIGHT_MS}ms ease`,
                transform:
                  phase === "fly" && flight
                    ? `translate(${flight.x}px, ${flight.y}px) scale(${flight.scale})`
                    : "none",
                opacity: phase === "fly" ? 0.15 : 1,
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between px-8">
        <button
          type="button"
          aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
          aria-pressed={torchOn}
          onClick={toggleTorch}
          disabled={!hasTorch}
          className={cn("tap transition-colors", torchOn ? "text-flame" : "text-chalk", !hasTorch && "opacity-30")}
        >
          <FlashOff className="h-6 w-6" />
        </button>

        <button
          type="button"
          aria-label="Flip camera"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="tap text-chalk"
        >
          <Flip className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center justify-between px-6 pt-6 pb-8">
        <Counter value={shotsLeft} />

        {/*
          Disabled until the stream is actually live.

          `capture` already refuses to run without a video frame, so tapping early did
          nothing at all — no shot, no error, no flash. A control that silently declines is
          worse than one that is visibly not ready yet, and the gap is widest on exactly the
          phone this matters on, where the camera takes a moment to come up.
        */}
        <button
          type="button"
          aria-label="Take photo"
          onClick={capture}
          disabled={out || disabled || phase !== "idle" || permission !== "live"}
          className="h-[88px] w-[88px] rounded-full border-4 border-chalk bg-surface transition-transform active:scale-95 disabled:opacity-40"
        />

        <button
          ref={thumbRef}
          type="button"
          onClick={onOpenAlbum}
          aria-label="Open album"
          className="h-[72px] w-[72px] overflow-hidden rounded-2xl bg-surface"
        >
          {latestThumb ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={latestThumb} alt="" className="h-full w-full object-cover" />
          ) : null}
        </button>
      </div>

      {out ? (
        <p className="px-8 pb-6 text-center text-[14px] leading-relaxed text-flame">
          That&rsquo;s all your shots. Everything opens for everyone at reveal time.
        </p>
      ) : null}
    </div>
  );
}
