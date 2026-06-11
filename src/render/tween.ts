/** Minimal tween runner driven by the Pixi ticker. */

interface ActiveTween {
  elapsed: number;
  duration: number;
  update: (t: number) => void;
  done?: () => void;
}

const active: ActiveTween[] = [];

/** Overshooting ease-out (the "pop"). */
export function backOut(t: number): number {
  const s = 1.70158;
  const u = t - 1;
  return u * u * ((s + 1) * u + s) + 1;
}

export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function tween(
  duration: number,
  update: (t: number) => void,
  done?: () => void,
): void {
  active.push({ elapsed: 0, duration, update, done });
  update(0);
}

/** Advance all tweens; call once per frame with delta milliseconds. */
export function updateTweens(deltaMS: number): void {
  for (let i = active.length - 1; i >= 0; i--) {
    const tw = active[i]!;
    tw.elapsed += deltaMS;
    const t = Math.min(1, tw.elapsed / tw.duration);
    tw.update(t);
    if (t >= 1) {
      active.splice(i, 1);
      tw.done?.();
    }
  }
}
