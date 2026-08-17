"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { FlashOff } from "@/components/roll/Icons";

export type ScannerState = "starting" | "live" | "denied" | "unsupported";

/**
 * `BarcodeDetector` is not in the DOM typings. Chrome and Edge on Android have had it for
 * years and decode in native code; Safari has never shipped it, which is why jsQR is here
 * rather than as a nicety — on iPhone it is the only path.
 */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

/** Long edge the frame is scaled to before decoding. Full sensor resolution buys nothing. */
const DECODE_EDGE = 640;
/** ~8fps. A QR held in front of a lens does not need sixty looks a second. */
const DECODE_INTERVAL_MS = 120;

/**
 * A viewfinder that watches for a QR code and reports what it reads.
 *
 * It hands the raw decoded string to `onResult` and takes no view on what that string means —
 * deciding whether it is one of our invitations belongs to the caller, which is what keeps
 * this from ever navigating somewhere a stranger's sticker pointed it.
 */
export function QrScanner({
  onResult,
  onStateChange,
  paused,
  className,
}: {
  onResult: (value: string) => void;
  onStateChange?: (state: ScannerState) => void;
  /** Freezes decoding without tearing the camera down — set while handling a hit. */
  paused?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastDecodeRef = useRef(0);
  /** Whichever code was reported last, so one sticker doesn't fire on every frame. */
  const reportedRef = useRef<string | null>(null);

  const [state, setState] = useState<ScannerState>("starting");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  /*
    The live props, mirrored into refs.

    The decode loop and the camera live in one effect that must not be torn down and rebuilt
    every time the parent re-renders with a fresh callback — restarting `getUserMedia` on a
    render is a visible flicker and, on some phones, a second permission prompt. Reading the
    props through refs keeps that effect mounted exactly once.

    Synced in an effect rather than assigned during render: a ref write during render is a
    side effect in a place React is allowed to run twice.
  */
  const onResultRef = useRef(onResult);
  const pausedRef = useRef(paused);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    onResultRef.current = onResult;
    pausedRef.current = paused;
    onStateChangeRef.current = onStateChange;
  });

  const report = useCallback((next: ScannerState) => {
    setState(next);
    onStateChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    function decodeFrame(timestamp: number) {
      frameRef.current = requestAnimationFrame(decodeFrame);

      if (pausedRef.current) return;
      if (timestamp - lastDecodeRef.current < DECODE_INTERVAL_MS) return;
      lastDecodeRef.current = timestamp;

      const video = videoRef.current;
      if (!video || video.readyState < video.HAVE_CURRENT_DATA) return;
      if (!video.videoWidth || !video.videoHeight) return;

      const found = (value: string) => {
        if (!value || value === reportedRef.current) return;
        reportedRef.current = value;
        onResultRef.current(value);
      };

      const detector = detectorRef.current;
      if (detector) {
        // Native path. Fire-and-forget: a frame that resolves after the next one started is
        // simply a slightly stale read of a code that is still being held up.
        void detector
          .detect(video)
          .then((codes) => {
            if (!cancelled && codes.length > 0) found(codes[0].rawValue);
          })
          .catch(() => {
            // A detector that starts throwing is a detector we stop asking.
            detectorRef.current = null;
          });
        return;
      }

      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      const scale = Math.min(1, DECODE_EDGE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);

      // `dontInvert` skips the second pass for light-on-dark codes. Ours are printed dark on
      // light, and halving the work matters on a mid-range phone.
      const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
      if (code?.data) found(code.data);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        report("unsupported");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
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
        const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setHasTorch(Boolean(capabilities?.torch));

        const Detector = (
          window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
        ).BarcodeDetector;
        if (Detector) {
          try {
            detectorRef.current = new Detector({ formats: ["qr_code"] });
          } catch {
            detectorRef.current = null;
          }
        }

        report("live");
        frameRef.current = requestAnimationFrame(decodeFrame);
      } catch {
        if (!cancelled) report("denied");
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };
  }, [report]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      // A real constraint on Android Chrome, absent from the DOM typings.
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  }

  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-3xl bg-void", className)}>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn("h-full w-full object-cover", state !== "live" && "opacity-0")}
      />

      {state === "live" ? (
        <>
          {/* Corner brackets rather than a full frame: they mark where to aim without
              covering the thing being aimed at. */}
          <div className="pointer-events-none absolute inset-6" aria-hidden="true">
            {[
              "top-0 left-0 border-t-2 border-l-2 rounded-tl-xl",
              "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl",
              "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl",
              "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
            ].map((corner) => (
              <span key={corner} className={cn("absolute h-9 w-9 border-chalk/80", corner)} />
            ))}
          </div>

          {hasTorch ? (
            <button
              type="button"
              aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
              aria-pressed={torchOn}
              onClick={toggleTorch}
              className={cn(
                "absolute right-3 bottom-3 flex h-11 w-11 items-center justify-center rounded-full bg-void/60 backdrop-blur-sm transition-colors",
                torchOn ? "text-flame" : "text-chalk",
              )}
            >
              <FlashOff className="h-5 w-5" />
            </button>
          ) : null}
        </>
      ) : null}

      {state === "starting" ? (
        <p className="absolute inset-0 grid place-items-center text-[14px] text-dust">
          Starting camera…
        </p>
      ) : null}
    </div>
  );
}
