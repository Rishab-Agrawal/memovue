"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { type ProcessedPhoto, decode, processCapture } from "@/lib/image";

type Facing = "environment" | "user";
type Permission = "idle" | "starting" | "live" | "denied" | "unsupported";

interface CameraViewProps {
  shotsLeft: number;
  onCaptured: (photo: ProcessedPhoto, previewUrl: string) => void;
  disabled?: boolean;
}

/**
 * A viewfinder that behaves like the phone's own camera app: full-bleed preview, one big
 * shutter, flip and torch where the hardware allows it.
 *
 * The captured frame is cropped to exactly what the guest could see. The sensor is wider
 * than the screen, and handing someone a photo containing things that were never in their
 * viewfinder feels broken.
 */
export function CameraView({ shotsLeft, onCaptured, disabled }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<Facing>("environment");
  const [permission, setPermission] = useState<Permission>("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
          video: {
            facingMode: facing,
            width: { ideal: 2560 },
            height: { ideal: 1440 },
          },
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
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }

  async function capture() {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || busy || disabled || shotsLeft <= 0) return;

    setBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 260);
    navigator.vibrate?.(12);

    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      // Mirror of CSS `object-fit: cover` — work out which slice of the sensor was
      // actually on screen, and keep only that.
      const scale = Math.max(cw / vw, ch / vh);
      const sw = Math.min(vw, cw / scale);
      const sh = Math.min(vh, ch / scale);
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");

      if (facing === "user") {
        // The preview is mirrored, so the saved frame is too — otherwise the photo you get
        // isn't the one you framed.
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const processed = await processCapture(canvas);
      onCaptured(processed, canvas.toDataURL("image/jpeg", 0.8));
    } finally {
      setBusy(false);
    }
  }

  async function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const bitmap = await decode(file);
      const processed = await processCapture(bitmap as CanvasImageSource & { width: number; height: number });
      onCaptured(processed, URL.createObjectURL(processed.preview));
    } finally {
      setBusy(false);
    }
  }

  const out = shotsLeft <= 0;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-ink-inset">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          permission === "live" ? "opacity-100" : "opacity-0",
          facing === "user" && "-scale-x-100",
        )}
      />

      {/* Shutter flash */}
      {flash ? (
        <div
          className="pointer-events-none absolute inset-0 bg-paper"
          style={{ animation: "mv-shutter 260ms ease-out" }}
        />
      ) : null}

      {permission === "starting" ? (
        <p className="absolute inset-0 grid place-items-center text-[15px] text-paper-dim">
          Waking the camera…
        </p>
      ) : null}

      {permission === "denied" || permission === "unsupported" ? (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <h2 className="font-display text-[1.7rem] text-paper">
              {permission === "denied" ? "Camera blocked" : "Camera unavailable here"}
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-paper-dim">
              {permission === "denied"
                ? "Allow camera access in your browser settings, or pick a photo instead."
                : "This browser won't open the camera directly. You can still take a photo and pick it."}
            </p>
            <label className="mt-6 inline-flex h-12 cursor-pointer items-center rounded-md bg-ember px-6 font-medium text-ink">
              Take a photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handleFilePick}
                disabled={out || busy}
              />
            </label>
          </div>
        </div>
      ) : null}

      {/* Torch sits top-left, where the flash control lives in every phone camera app.
          The bottom-left corner is left free for the album button, same as the camera roll. */}
      {hasTorch ? (
        <button
          type="button"
          onClick={toggleTorch}
          aria-pressed={torchOn}
          aria-label="Torch"
          className={cn(
            "absolute top-[calc(var(--safe-top)+4.5rem)] left-5 grid h-11 w-11 place-items-center rounded-full backdrop-blur-md transition-colors",
            torchOn ? "bg-marigold text-ink" : "bg-ink/45 text-paper",
          )}
        >
          <BoltIcon />
        </button>
      ) : null}

      {/* ---------------------------------------------------------- controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-8 pb-[calc(var(--safe-bottom)+2rem)]">
        <div className="w-14" />

        <button
          type="button"
          onClick={capture}
          disabled={out || busy || permission !== "live"}
          aria-label={out ? "No photos left" : "Take photo"}
          className={cn(
            "pointer-events-auto grid h-[72px] w-[72px] place-items-center rounded-full",
            "ring-[3px] ring-paper/90 transition-transform duration-100",
            "active:scale-90 disabled:opacity-35",
          )}
        >
          <span
            className={cn(
              "h-[58px] w-[58px] rounded-full transition-colors",
              out ? "bg-paper/30" : "bg-paper",
            )}
          />
        </button>

        <div className="flex w-14 justify-end">
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            aria-label="Switch camera"
            disabled={permission !== "live"}
            className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-ink/45 text-paper backdrop-blur-md disabled:opacity-35"
          >
            <FlipIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4.5 13.2h5.8L11 22l8.5-11.2h-5.8L13 2Z" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10a8 8 0 0 0-13.5-3.5L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 14a8 8 0 0 0 13.5 3.5L20 15" />
      <path d="M20 20v-5h-5" />
    </svg>
  );
}
