/**
 * The figure's hop when the ちょうど stamp lands. Translate only: the body is never
 * scaled, so its proportions stay the fit engine's.
 */

/** Up 7 px and back: easing out on the way up, in on the way down. */
export const HOP_KEYFRAMES: Keyframe[] = [
  { transform: 'translateY(0)', easing: 'ease-out' },
  { transform: 'translateY(-7px)', offset: 0.45, easing: 'ease-in' },
  { transform: 'translateY(0)' },
];

/** 380 ms, starting as the stamp first touches down (55 % of its 260 ms drop). */
export const HOP_TIMING: KeyframeAnimationOptions = { duration: 380, delay: 140 };

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Hop the element once; nothing under reduced motion or where the Web Animations API is missing. */
export function hop(el: Element | null): void {
  if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return;
  el.animate(HOP_KEYFRAMES, HOP_TIMING);
}
