/**
 * A critically damped spring, and the momentum projection that decides where to send it.
 *
 * CSS transitions can't do the thing that matters here: continue at the speed the finger was
 * already moving. A transition always starts from rest, so however carefully you tune the
 * curve there is a visible stall at the instant the drag becomes an animation — the seam
 * that separates an interface that feels physical from one that feels merely smooth. A
 * spring takes an initial velocity, so the handoff is invisible.
 *
 * Critically damped by default (no overshoot). Bounce is only honest when a gesture actually
 * threw something; a panel that simply appeared has no momentum to express.
 */

export interface SpringHandle {
  /** Value right now, mid-flight. Read this to start a new spring from where you are. */
  value(): number;
  /** Speed right now, in units per second. Hand it to the next spring on an interrupt. */
  velocity(): number;
  stop(): void;
}

/**
 * `response` is the time in seconds for the value to reach its target — not a duration.
 * A spring has no duration; it settles when it settles. Lower is snappier.
 */
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
  // For a critically damped system the closed form is exact, so there's no integrator drift
  // and no per-frame accumulation of error at low frame rates.
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

    // Settled once it is both close enough and slow enough — distance alone would stop a
    // value that is still travelling through its target.
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

/**
 * Where a flick would come to rest if you let it decelerate — Apple's projection from
 * *Designing Fluid Interfaces*, not the textbook v²/2a.
 *
 * Deciding a gesture's outcome from the release *position* ignores that the user already
 * told you where they were going. Projecting first is what makes a short, fast flick throw
 * something all the way out, and a long slow drag let it fall back.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Speed over the last few pointer samples, in px/s.
 *
 * The instantaneous delta between the final two events is noise — fingers stall for a frame
 * at the end of a flick, and reading only that frame turns a hard throw into a dead drop.
 * A short window over recent samples is what the release actually felt like.
 */
export function velocityFrom(samples: { y: number; t: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first = samples[0];
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return ((last.y - first.y) / dt) * 1000;
}
