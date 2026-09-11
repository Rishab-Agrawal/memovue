"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { type ProcessedPhoto, decode, processCapture } from "@/lib/image";

import { Pill } from "@/components/roll/Chrome";
import { Flash, FlashOff, Flip } from "@/components/roll/Icons";

type Facing = "environment" | "user";
type Permission = "idle" | "starting" | "live" | "denied" | "unsupported";
type Phase = "idle" | "flash" | "hold" | "fly";

const FLASH_MS = 55;
const HOLD_MS = 600;
const FLIGHT_MS = 420;
const PHOTO_TIMEOUT_MS = 3000;

/** `torch` and `focusMode` are real constraints on Android Chrome but not in the DOM typings yet. */
const advanced = (set: { torch?: boolean; focusMode?: string }) =>
  ({ advanced: [set] }) as unknown as MediaTrackConstraints;

/**
 * A still from the camera's photo pipeline rather than a frame of video: the phone denoises
 * and sharpens a photo in ways it never does a frame. Only Android Chrome has `ImageCapture`,
 * and some phones answer smaller than the stream, so anything short of the frame's size comes
 * back null and the caller takes the frame instead.
 */
async function takePhoto(track: MediaStreamTrack | undefined, video: HTMLVideoElement) {
  if (!track || typeof ImageCapture === "undefined") return null;
  try {
    const photo = await decode(
      await Promise.race([
        new ImageCapture(track).takePhoto(),
        // Some camera stacks never answer, and a shutter that hangs is worse than a frame.
        new Promise<never>((_, reject) => setTimeout(reject, PHOTO_TIMEOUT_MS)),
      ]),
    );
    return photo.width >= video.videoWidth && photo.height >= video.videoHeight ? photo : null;
  } catch {
    return null;
  }
}

interface CameraViewProps {
  shotsLeft: number;
  /** This guest's whole quota, so the rule under the figure has something to be a fraction of. */
  shotsTotal: number;
  /**
   * The roll has ended. Separate from being out of film, because it is a different fact about
   * a different thing and the two want different words on the screen.
   */
  closed?: boolean;
  onCaptured: (photo: ProcessedPhoto) => void;
  /** Leaves the camera for the roll. Absent for a guest who has no roll screen of their own. */
  onLeave?: () => void;
  /** Blur data for the last shot, which is all the thumbnail ever shows. */
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
  shotsTotal,
  closed = false,
  onCaptured,
  onLeave,
  latestThumb,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [facing, setFacing] = useState<Facing>("environment");
  const [permission, setPermission] = useState<Permission>("idle");
  /** Bumped by "Try again", which is the only way back from a refusal. */
  const [attempt, setAttempt] = useState(0);
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
        // 4:3 is the whole sensor. Asking for 16:9 gets a cropped video mode, often only
        // 1080p, and the viewfinder shows it stretched.
        const size = { width: { ideal: 4096 }, height: { ideal: 3072 } };
        const wanted = { video: { ...size, facingMode: facing }, audio: false };
        let stream = await navigator.mediaDevices.getUserMedia(wanted);

        // Some browsers ignore `facingMode` and open the wrong camera; ask for the back one by name.
        if (facing === "environment" && stream.getVideoTracks()[0].getSettings().facingMode !== "environment") {
          const back = (await navigator.mediaDevices.enumerateDevices()).find(
            (device) => device.kind === "videoinput" && /back|rear|environment/i.test(device.label),
          );
          if (back) {
            stream.getTracks().forEach((track) => track.stop());
            stream = await navigator.mediaDevices
              .getUserMedia({ video: { ...size, deviceId: { exact: back.deviceId } }, audio: false })
              .catch(() => navigator.mediaDevices.getUserMedia(wanted));
          }
        }
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
  }, [facing, stop, attempt]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints(advanced({ torch: next }));
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }

  /** Tap the viewfinder to refocus, where the camera allows it; elsewhere a tap does nothing. */
  function refocus() {
    const track = streamRef.current?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.();
    if (!track || !capabilities || !("focusMode" in capabilities)) return;
    void track.applyConstraints(advanced({ focusMode: "single-shot" })).catch(() => {});
  }

  function runFlight(preview: Blob) {
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
    const url = URL.createObjectURL(preview);
    setFrozen(url);
    setPhase("hold");

    timers.current.push(
      setTimeout(() => setPhase("fly"), HOLD_MS),
      setTimeout(() => {
        URL.revokeObjectURL(url);
        setPhase("idle");
        setFrozen(null);
        setFlight(null);
      }, HOLD_MS + FLIGHT_MS),
    );
  }

  async function capture() {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || phase !== "idle" || shotsLeft <= 0 || closed) return;

    setPhase("flash");
    navigator.vibrate?.(12);

    try {
      const track = streamRef.current?.getVideoTracks()[0];
      const photo = await takePhoto(track, video);
      // Taking a still switches the torch off on some Android phones; put it back.
      if (torchOn) void track?.applyConstraints(advanced({ torch: true })).catch(() => {});
      const source = photo ?? video;
      const vw = photo?.width ?? video.videoWidth;
      const vh = photo?.height ?? video.videoHeight;
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
      context.drawImage(source, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);

      const processed = await processCapture(canvas);
      onCaptured(processed);

      timers.current.push(
        // The preview is already encoded; re-encoding the full canvas here stalled the shutter.
        setTimeout(() => runFlight(processed.preview), FLASH_MS),
      );
    } catch {
      setPhase("idle");
    }
  }

  const out = shotsLeft <= 0;
  const flying = phase === "hold" || phase === "fly";

  return (
    <div className="flex h-full flex-col bg-page">
      {/* `min-h-0` + `max-h-full`: the frame keeps its 4:5 shape wherever there is room for
          it and gives height back where there is not, rather than growing past the screen and
          taking the shutter with it. */}
      <div className="flex min-h-0 flex-1 items-center px-4 py-4">
        <div
          ref={frameRef}
          className="relative aspect-[4/5] max-h-full w-full overflow-hidden rounded-[2rem] bg-void"
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            onClick={refocus}
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
                    ? "This browser can’t open the camera."
                    : "MemoVue needs camera access. Allow it for this site in your browser’s settings, then try again."}
                </p>
                {/* Refusing once used to end the screen: a sentence, and nothing to press. */}
                {permission === "denied" ? (
                  <Pill variant="quiet" className="mt-5" onClick={() => setAttempt((n) => n + 1)}>
                    Try again
                  </Pill>
                ) : null}
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
          {torchOn ? <Flash className="h-6 w-6" /> : <FlashOff className="h-6 w-6" />}
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
        {/*
          What is left, stated. This was a mechanical frame dial with the neighbouring numbers
          half-visible either side, which is a lovely object and the wrong one: on a phone in a
          dark room the number you need is the smallest thing in the widget, wrapped in two
          numbers that are not true. Here the figure is the whole control, and the rule under
          it carries the part the dial was really for — the sense that the film is running out.
        */}
        <div className="w-[72px]">
          <p
            className="tabular text-[38px] leading-none font-medium text-chalk"
            data-testid="shots-left"
          >
            {shotsLeft}
          </p>
          <p className="marking mt-1.5 text-dust">Left</p>
          <span
            aria-hidden="true"
            className="mt-2 block h-0.5 w-full overflow-hidden rounded-full bg-hair-bright"
          >
            <span
              className="block h-full bg-flame transition-[width] duration-500 ease-[var(--ease-out-soft)]"
              style={{ width: `${shotsTotal > 0 ? (shotsLeft / shotsTotal) * 100 : 0}%` }}
            />
          </span>
        </div>

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
          disabled={out || closed || phase !== "idle" || permission !== "live"}
          className="h-[88px] w-[88px] rounded-full border-4 border-chalk bg-surface transition-transform active:scale-95 disabled:opacity-40"
        />

        {/*
          The last shot, blurred — the same seal everything else in the roll is under, and the
          only thing that makes this square read as a camera roll rather than a hole in the
          layout. It is the flight's landing pad, so it keeps its ref whether or not it leads
          anywhere: an anonymous guest has no roll screen to send them to.
        */}
        <button
          ref={thumbRef}
          type="button"
          onClick={onLeave}
          disabled={!onLeave}
          aria-label="Open the roll"
          className="h-[72px] w-[72px] overflow-hidden rounded-2xl bg-surface"
        >
          {latestThumb ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={latestThumb}
              alt=""
              className="h-full w-full object-cover"
              style={{ filter: "blur(4px) saturate(0.6)" }}
            />
          ) : null}
        </button>
      </div>

      {/* Only the roll ending gets a word. Running out of film closes the camera instead —
          a spent viewfinder explaining itself is a screen nobody stays on long enough to
          read, and it flashed up for a beat on the way out. */}
      {closed ? (
        <p className="px-8 pb-6 text-center text-[14px] leading-relaxed text-flame">
          The roll has closed. Everything opens for everyone at reveal time.
        </p>
      ) : null}
    </div>
  );
}
