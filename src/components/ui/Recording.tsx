"use client";

import { useEffect, useRef, useState } from "react";

import { Pause, Play } from "@/components/roll/Icons";
import { Phone } from "@/components/ui/Phone";

/*
  A screen recording in a phone, on a muted loop. It plays only while on screen and not under
  reduced motion, and it can be stopped: a loop that runs past five seconds needs a pause
  (WCAG 2.2.2). Without script it is its poster.
*/
export function Recording({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  /** The viewer's choice. Null follows the motion preference. */
  const [held, setHeld] = useState<boolean | null>(null);

  useEffect(() => {
    const element = video.current!;
    if (held ?? matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.pause();
      return;
    }
    const seen = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) element.play().catch(() => {});
      else element.pause();
    });
    seen.observe(element);
    return () => seen.disconnect();
  }, [held]);

  return (
    <div className={className}>
      <Phone>
        <video
          ref={video}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="block w-full"
        />
      </Phone>
      <button
        type="button"
        onClick={() => setHeld(playing)}
        className="marking mx-auto mt-3 flex h-11 items-center gap-2 px-2 transition-colors hover:text-chalk"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        {playing ? "Pause" : "Play"}
      </button>
    </div>
  );
}
