"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { type ProcessedPhoto, decode, processCapture } from "@/lib/image";

import { Pill } from "@/components/roll/Chrome";
import { Flash, FlashOff, Flip } from "@/components/roll/Icons";

type Facing = "environment" | "user";
type Permission = "idle" | "starting" | "live" | "denied" | "unsupported";
type Phase = "idle" | "flash" | "hold" | "fly";

const FLASH_MS = 55;
/** How long the lamp leads the shutter, so the exposure settles on the lit scene. */
const FLASH_LEAD_MS = 250;
const HOLD_MS = 600;
const FLIGHT_MS = 420;
/** Frames the travel between zoom stops is spread over. */
const ZOOM_STEPS = 10;
const PHOTO_TIMEOUT_MS = 3000;

/** `torch` and `zoom` are in the part of the spec the DOM typings lack. Android Chrome only. */
type Hardware = { torch?: boolean; zoom?: number };
const constrain = (settings: Hardware) => ({ advanced: [settings] }) as unknown as MediaTrackConstraints;
type Capabilities = { torch?: boolean; zoom?: { min: number; max: number } };

/**
 * The two zoom stops, or nothing. 1× is never below 1 (ultra-wides report 0.5) and 2× is
 * offered only when the camera can reach it; some stacks report the scale in hundredths.
 */
export function zoomStops(range?: { min: number; max: number }) {
  if (!range) return null;
  const one = Math.max(1, range.min);
  return range.max >= one * 2 ? { one, two: one * 2 } : null;
}

/**
 * A still from the photo pipeline, which the phone denoises and sharpens, rather than a video
 * frame. Null when unsupported, too slow, or smaller than the stream; the caller uses the frame.
 */
async function takePhoto(track: MediaStreamTrack | undefined, video: HTMLVideoElement) {
  if (!track || typeof ImageCapture === "undefined") return null;
  try {
    const photo = await decode(
      await Promise.race([
        // Never `fillLightMode`: Chrome keeps it after the shot and flashes every preview frame.
        new ImageCapture(track).takePhoto(),
        // Some camera stacks never answer.
        new Promise<never>((_, reject) => setTimeout(reject, PHOTO_TIMEOUT_MS)),
      ]),
    );
    return photo.width >= video.videoWidth && photo.height >= video.videoHeight ? photo : null;
  } catch {
    return null;
  }
}

/** Waits, and lets the browser paint what was just set before the next line blocks it. */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const painted = () =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/**
 * The slice of the sensor that was on screen — a mirror of `object-fit: cover`. `width` caps
 * the output, for the freeze frame that only has to look right at display size.
 */
function crop(
  source: CanvasImageSource,
  vw: number,
  vh: number,
  frame: HTMLElement,
  mirrored: boolean,
  width?: number,
) {
  const scale = Math.max(frame.clientWidth / vw, frame.clientHeight / vh);
  const sw = Math.min(vw, frame.clientWidth / scale);
  const sh = Math.min(vh, frame.clientHeight / scale);

  const shrink = width && width < sw ? width / sw : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * shrink);
  canvas.height = Math.round(sh * shrink);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  if (mirrored) {
    // The preview is mirrored, so the saved frame is too.
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(source, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

interface CameraViewProps {
  shotsLeft: number;
  /** This guest's whole quota, which the bar under the figure is a fraction of. */
  shotsTotal: number;
  /** The roll has ended — a different fact from being out of film. */
  closed?: boolean;
  onCaptured: (photo: ProcessedPhoto) => void;
  /** Leaves the camera for the roll. Absent for a guest who has no roll screen of their own. */
  onLeave?: () => void;
  /** Blur data for the last shot, which is all the thumbnail ever shows. */
  latestThumb?: string | null;
  /** The shots pool; given, the counter links there. The sample camera has none. */
  poolHref?: string;
}

/**
 * The viewfinder. The frame is cropped to what was on screen, and there is no keep/retake step:
 * the shutter spends a shot, holds the frame for a beat, then flies it into the thumbnail.
 */
export function CameraView({
  shotsLeft,
  shotsTotal,
  closed = false,
  onCaptured,
  onLeave,
  latestThumb,
  poolHref,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Which zoom travel owns the lens. See `zoom`. */
  const travel = useRef(0);

  const [facing, setFacing] = useState<Facing>("environment");
  const [permission, setPermission] = useState<Permission>("idle");
  /** Bumped by "Try again", which is the only way back from a refusal. */
  const [attempt, setAttempt] = useState(0);
  /** Whether the shutter fires the lamp. The lamp itself is only lit for the shot. */
  const [flashOn, setFlashOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  /** The two zoom levels this lens can actually reach, in whatever units it reports. */
  const [lens, setLens] = useState<{ one: number; two: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  /** A photograph still being taken behind the animation. See `capture`. */
  const [working, setWorking] = useState(false);
  const [frozen, setFrozen] = useState<string | null>(null);
  const [flight, setFlight] = useState<{ x: number; y: number; scale: number } | null>(null);

  const stop = useCallback(() => {
    // Abandons any zoom still travelling: the track it was driving is about to end.
    travel.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  /*
    Refuse a pinch, which would zoom the page and push the controls off screen. Not
    `touch-action: none`: Safari still zooms the page on a pinch with it.
  */
  useEffect(() => {
    const pinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("touchmove", pinch, { passive: false });
    return () => document.removeEventListener("touchmove", pinch);
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
        // 4:3 is the whole sensor; 16:9 gets a cropped, often 1080p, video mode.
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
        const capabilities = track.getCapabilities?.() as Capabilities | undefined;
        setHasTorch(Boolean(capabilities?.torch));
        setFlashOn(false);

        // Zoom is asked of the camera, which gathers real detail (or switches lens), rather
        // than done by scaling the picture.
        setLens(zoomStops(capabilities?.zoom));
        setZoomed(false);
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

  /*
    Travels between the two stops rather than cutting. Each step asks the lens for a slightly
    longer focal length and waits for a paint, so every frame on screen is real. Geometric, so
    the zoom feels even; `from` is read off the track so a press mid-travel continues from
    where the lens actually is.
  */
  async function zoom(into: boolean) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !lens || into === zoomed) return;

    // The ring moves now; the picture catches up over the next few frames.
    setZoomed(into);

    const steps = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : ZOOM_STEPS;

    const to = into ? lens.two : lens.one;
    const from = (track.getSettings() as { zoom?: number }).zoom || (into ? lens.one : lens.two);
    const run = ++travel.current;

    try {
      for (let step = 1; step <= steps; step++) {
        // A newer press, or the stream going away, owns the lens now.
        if (travel.current !== run) return;
        await track.applyConstraints(constrain({ zoom: from * (to / from) ** (step / steps) }));
        if (step < steps) await painted();
      }
    } catch {
      // A control the camera declines comes off the screen.
      if (travel.current === run) setLens(null);
    }
  }

  function runFlight(src: string) {
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
    setFrozen(src);
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

  /**
   * The shutter. The freeze comes off the frame already on screen — a few milliseconds — and
   * goes up before the slow part (`takePhoto`, then encoding) starts, so the camera never goes
   * dark while the real photograph is taken.
   */
  async function capture() {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || phase !== "idle" || working || shotsLeft <= 0 || closed) return;

    setPhase("flash");
    setWorking(true);
    navigator.vibrate?.(12);

    const track = streamRef.current?.getVideoTracks()[0];
    try {
      if (flashOn) {
        // Behind the closed shutter, so the wait reads as the shutter rather than lag.
        await track?.applyConstraints(constrain({ torch: true })).catch(() => setHasTorch(false));
        await wait(FLASH_LEAD_MS);
      }

      const mirrored = facing === "user";
      const shown = crop(
        video,
        video.videoWidth,
        video.videoHeight,
        frame,
        mirrored,
        frame.clientWidth,
      ).toDataURL("image/jpeg", 0.7);

      await wait(FLASH_MS);
      runFlight(shown);
      await painted();

      const photo = await takePhoto(track, video);
      if (flashOn) void track?.applyConstraints(constrain({ torch: false })).catch(() => {});

      onCaptured(
        await processCapture(
          crop(
            photo ?? video,
            photo?.width ?? video.videoWidth,
            photo?.height ?? video.videoHeight,
            frame,
            mirrored,
          ),
        ),
      );
    } catch {
      if (flashOn) void track?.applyConstraints(constrain({ torch: false })).catch(() => {});
      setPhase("idle");
      setFrozen(null);
    } finally {
      // Re-armed only now, not when the animation ends: the last frame of a quota taken twice
      // would be refused by the server and deleted by the queue.
      setWorking(false);
    }
  }

  const out = shotsLeft <= 0;
  const flying = phase === "hold" || phase === "fly";

  const counter = (
    <>
      <p className="tabular text-[38px] leading-none font-medium text-chalk" data-testid="shots-left">
        {shotsLeft}
      </p>
      <p className="marking mt-1.5 text-dust">Left</p>
      <span
        aria-hidden="true"
        className="mt-2 block h-0.5 w-full overflow-hidden rounded-full bg-hair-bright"
      >
        <span
          className="block h-full bg-flame transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${shotsTotal > 0 ? Math.min(100, (shotsLeft / shotsTotal) * 100) : 0}%` }}
        />
      </span>
    </>
  );

  return (
    <div className="flex h-full flex-col bg-page">
      {/* `min-h-0` + `max-h-full`: the 4:5 frame gives height back rather than pushing the shutter off screen. */}
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
                {permission === "denied" ? (
                  <Pill variant="quiet" className="mt-5" onClick={() => setAttempt((n) => n + 1)}>
                    Try again
                  </Pill>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Black, not white: a shutter closing rather than a screen flash. */}
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
          aria-label={flashOn ? "Turn flash off" : "Turn flash on"}
          aria-pressed={flashOn}
          onClick={() => setFlashOn(!flashOn)}
          disabled={!hasTorch}
          className={cn("tap transition-colors", flashOn ? "text-flame" : "text-chalk", !hasTorch && "opacity-30")}
        >
          {flashOn ? <Flash className="h-6 w-6" /> : <FlashOff className="h-6 w-6" />}
        </button>

        {/* Two stops rather than a pinch, which lags the fingers. Absent where there is no zoom. */}
        {lens ? (
          <div role="group" aria-label="Zoom" className="flex items-center gap-1">
            {([false, true] as const).map((into) => (
              <button
                key={String(into)}
                type="button"
                aria-pressed={into === zoomed}
                onClick={() => zoom(into)}
                className={cn(
                  "tabular h-9 w-9 rounded-full border text-[13px] font-medium transition-colors duration-150",
                  into === zoomed ? "border-chalk text-chalk" : "border-transparent text-dust",
                )}
              >
                {into ? "2×" : "1×"}
              </button>
            ))}
          </div>
        ) : null}

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
        {poolHref ? (
          <Link
            href={poolHref}
            aria-label="Shots pool"
            className="block w-[72px] transition-opacity duration-150 active:opacity-60"
          >
            {counter}
          </Link>
        ) : (
          <div className="w-[72px]">{counter}</div>
        )}

        {/* Disabled until the stream is live, so an early tap is visibly not ready rather than ignored. */}
        <button
          type="button"
          aria-label="Take photo"
          onClick={capture}
          disabled={out || closed || working || phase !== "idle" || permission !== "live"}
          className="h-[88px] w-[88px] rounded-full border-4 border-chalk bg-surface disabled:opacity-40"
        />

        {/* The last shot, blurred. Also the flight's landing pad, so it keeps its ref even when it leads nowhere. */}
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

      {/* Only the roll ending gets a word; running out of film leaves the camera instead. */}
      {closed ? (
        <p className="px-8 pb-6 text-center text-[14px] leading-relaxed text-flame">
          The roll has closed. Everything opens for everyone at reveal time.
        </p>
      ) : null}
    </div>
  );
}
