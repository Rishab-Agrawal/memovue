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
const HOLD_MS = 600;
const FLIGHT_MS = 420;
const PHOTO_TIMEOUT_MS = 3000;

/**
 * The camera's own controls — `torch`, `zoom` — live in the optional half of the spec that
 * the DOM typings haven't caught up with. Android Chrome honours both; Safari neither.
 */
type Hardware = { torch?: boolean; zoom?: number };
const constrain = (settings: Hardware) => ({ advanced: [settings] }) as unknown as MediaTrackConstraints;
type Capabilities = { torch?: boolean; zoom?: { min: number; max: number } };

/**
 * The two stops the zoom control offers, or nothing at all.
 *
 * `min` is the widest thing the camera has rather than 1×: it is 1 on most phones, 0.5 where
 * there is an ultra-wide, and a handful of Android stacks report the whole scale in
 * hundredths. In all three, 1× is the neutral value — never below 1, never above what the
 * camera reports — and 2× is only offered when the camera can really reach it.
 */
export function zoomStops(range?: { min: number; max: number }) {
  if (!range) return null;
  const one = Math.max(1, range.min);
  return range.max >= one * 2 ? { one, two: one * 2 } : null;
}

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

/** Waits, and lets the browser paint what was just set before the next line blocks it. */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const painted = () =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/**
 * The slice of the sensor that was actually on screen, drawn into a canvas.
 *
 * A mirror of CSS `object-fit: cover`: the sensor is wider than the viewport, and handing
 * somebody a photo containing things that were never in their viewfinder feels broken.
 *
 * `width` caps the output. The photograph keeps every pixel it was given; the freeze only
 * has to look right at the size it is already being shown at, and encoding it at sensor size
 * would cost the very milliseconds it exists to save.
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
    // The preview is mirrored, so the saved frame is too — otherwise the photo you get is
    // not the one you framed.
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(source, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
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
  /**
   * The shots pool. Given, the counter in the corner becomes the way there — the figure and
   * the place you go to change it are the same object. The sample camera has no pool.
   */
  poolHref?: string;
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
  poolHref,
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
  /** The two zoom levels this lens can actually reach, in whatever units it reports. */
  const [lens, setLens] = useState<{ one: number; two: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  /** A photograph still being taken behind the animation. See `capture`. */
  const [working, setWorking] = useState(false);
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

  /*
    A pinch on a viewfinder means one thing, and the browser does the other: it zooms the
    page, so the shutter and the counter slide off screen and the guest is left panning
    around a magnified photograph of a camera. Refusing the second finger leaves the first —
    and so every control here — exactly as it was.

    Not `touch-action: none` in CSS: Safari honours that for panning and still zooms the page
    on a pinch, and half of this audience is holding an iPhone.
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
        const capabilities = track.getCapabilities?.() as Capabilities | undefined;
        setHasTorch(Boolean(capabilities?.torch));
        setTorchOn(false);

        /*
          Zoom, asked of the camera rather than done to the picture.

          The alternative — scaling the frame up afterwards — is the one thing this must not
          be: it enlarges pixels rather than gathering more of them, and hands the guest a
          soft photograph of the same detail. Driving the track instead means the phone does
          whatever its own camera app would, which on a multi-lens phone is to change lens.
        */
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

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints(constrain({ torch: next }));
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }

  async function zoom(into: boolean) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !lens || into === zoomed) return;
    try {
      await track.applyConstraints(constrain({ zoom: into ? lens.two : lens.one }));
      setZoomed(into);
    } catch {
      // A control the camera declines is worse than no control: take it off the screen.
      setLens(null);
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
   * The shutter, which answers in about as long as it takes to blink.
   *
   * The order here is the whole point. The freeze comes off the frame that is already on
   * screen — one small draw and one small encode, a few milliseconds — and goes up before
   * anything slow has started. Only then does the photograph itself get taken.
   *
   * It used to be the other way round, and the two halves are not remotely the same length:
   * `ImageCapture.takePhoto` is a real exposure and can take the better part of a second,
   * and the three derivatives after it are encoded on the main thread. All of that happened
   * with the viewfinder blacked out and nothing on screen, which is what made an instant
   * shutter feel like a slow one — you pressed the button and the camera went dark.
   *
   * The photograph is still the photograph: the still is what gets uploaded, and this only
   * changes when the animation is allowed to start.
   */
  async function capture() {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || phase !== "idle" || working || shotsLeft <= 0 || closed) return;

    setPhase("flash");
    setWorking(true);
    navigator.vibrate?.(12);

    try {
      const mirrored = facing === "user";
      const shown = crop(
        video,
        video.videoWidth,
        video.videoHeight,
        frame,
        mirrored,
        frame.clientWidth,
      ).toDataURL("image/jpeg", 0.7);

      // Black for a beat, then the frame they took, on screen and already flying.
      await wait(FLASH_MS);
      runFlight(shown);
      await painted();

      const track = streamRef.current?.getVideoTracks()[0];
      const photo = await takePhoto(track, video);
      // Taking a still switches the torch off on some Android phones; put it back.
      if (torchOn) void track?.applyConstraints(constrain({ torch: true })).catch(() => {});

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
      setPhase("idle");
      setFrozen(null);
    } finally {
      /*
        Only now is the shutter armed again — not when the animation ends.

        The two no longer finish together, and the gap is the dangerous direction: the last
        frame of a quota could be taken twice, the server would refuse the second, and the
        queue deletes what the server refuses. A photograph somebody took, gone.
      */
      setWorking(false);
    }
  }

  const out = shotsLeft <= 0;
  const flying = phase === "hold" || phase === "fly";

  /*
    What is left, stated. This was a mechanical frame dial with the neighbouring numbers
    half-visible either side, which is a lovely object and the wrong one: on a phone in a
    dark room the number you need is the smallest thing in the widget, wrapped in two numbers
    that are not true. Here the figure is the whole control, and the rule under it carries the
    part the dial was really for — the sense that the film is running out.
  */
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

        {/*
          Two stops rather than a pinch. A pinch on a viewfinder is a continuous gesture
          answered by an asynchronous constraint, so it lags the fingers and lands somewhere
          nobody chose; and the phones this runs on have two lenses, not a continuum. Absent
          entirely where the camera has no zoom to give — an iPhone, or a front camera —
          rather than present and dead.
        */}
        {lens ? (
          <div role="group" aria-label="Zoom" className="flex items-center gap-1">
            {([false, true] as const).map((into) => (
              <button
                key={String(into)}
                type="button"
                aria-pressed={into === zoomed}
                onClick={() => zoom(into)}
                className={cn(
                  "tabular h-9 w-9 rounded-full text-[13px] font-medium transition-colors duration-150",
                  into === zoomed ? "bg-flame text-void" : "text-dust",
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
          disabled={out || closed || working || phase !== "idle" || permission !== "live"}
          className="h-[88px] w-[88px] rounded-full border-4 border-chalk bg-surface disabled:opacity-40"
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
