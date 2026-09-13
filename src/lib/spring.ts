/**
 * A critically damped spring, and the momentum projection that decides where to send it.
 *
 * A CSS transition always starts from rest, so the hand-off from a drag stalls; a spring takes
 * the finger's velocity and the hand-off is invisible. No overshoot by default.
 */

interface SpringHandle {
  /** Value right now, mid-flight. Read this to start a new spring from where you are. */
  value(): number;
  /** Speed right now, in units per second. Hand it to the next spring on an interrupt. */
  velocity(): number;
  stop(): void;
}

/** `response` is roughly the seconds to reach the target. Lower is snappier. */
export function spring({
  from,
  to,
  velocity = 0,
  response = 0.4,
  onFrame,
  onRest,
}: {
  from: number;
  to: number;
  velocity?: number;
  response?: number;
  onFrame: (value: number) => void;
  onRest?: () => void;
}): SpringHandle {
  // Closed form, so no integrator drift at low frame rates.
  const omega = (2 * Math.PI) / response;
  const displacement = from - to;
  const start = performance.now();

  let frame = 0;
  let current = from;
  let currentVelocity = velocity;
  let running = true;

  function step(now: number) {
    const t = (now - start) / 1000;
    const decay = Math.exp(-omega * t);

    //  x(t) = to + (d + (v + ω·d)·t)·e^(−ωt)
    const c = velocity + omega * displacement;
    current = to + (displacement + c * t) * decay;
    currentVelocity = (c - omega * (displacement + c * t)) * decay;

    // Settled when both close and slow — distance alone would stop a value passing through.
    if (Math.abs(current - to) < 0.1 && Math.abs(currentVelocity) < 1) {
      current = to;
      currentVelocity = 0;
      running = false;
      onFrame(to);
      onRest?.();
      return;
    }

    onFrame(current);
    frame = requestAnimationFrame(step);
  }

  frame = requestAnimationFrame(step);

  return {
    value: () => current,
    velocity: () => currentVelocity,
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
    },
  };
}

/** Where a flick would come to rest — Apple's projection from *Designing Fluid Interfaces*. */
function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Speed over the last few pointer samples, in px/s; the final frame alone is noise. */
export function velocityFrom(samples: { v: number; t: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first = samples[0];
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return ((last.v - first.v) / dt) * 1000;
}

/**
 * Which way a horizontal swipe lands: -1 back, 0 stay, +1 forward. Projects the release
 * velocity first, so a short hard flick carries and a slow drag falls back. 0 at the ends.
 */
export function swipeDelta({
  dx,
  velocity,
  width,
  index,
  count,
  distance = 0.28,
  minVelocity = 500,
}: {
  dx: number;
  velocity: number;
  width: number;
  index: number;
  count: number;
  distance?: number;
  minVelocity?: number;
}): -1 | 0 | 1 {
  const projected = dx + projectMomentum(velocity);

  let delta: -1 | 0 | 1 = 0;
  if (projected < -width * distance || velocity < -minVelocity) delta = 1;
  else if (projected > width * distance || velocity > minVelocity) delta = -1;

  const next = index + delta;
  return next < 0 || next >= count ? 0 : delta;
}
