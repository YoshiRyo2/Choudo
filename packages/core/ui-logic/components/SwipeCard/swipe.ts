/**
 * When a dragged Discover card counts as a like or a pass. Pure so the
 * thresholds can be tested without a browser.
 */

export type SwipeOutcome = 'like' | 'pass' | null;

/** Drag this share of the card's width to decide. */
export const DISTANCE_SHARE = 0.3;
/** Or flick faster than this (px per ms) once past MIN_FLICK_PX. */
export const FLICK_SPEED = 0.5;
export const MIN_FLICK_PX = 30;
/** Most the card tilts, in degrees, while dragged a full width. */
export const MAX_TILT = 12;

/** Right = like, left = pass, anything short of the thresholds snaps back. */
export function swipeOutcome(dx: number, velocityX: number, cardWidth: number): SwipeOutcome {
  const far = Math.abs(dx) >= cardWidth * DISTANCE_SHARE;
  const flicked = Math.abs(dx) >= MIN_FLICK_PX && Math.abs(velocityX) >= FLICK_SPEED && Math.sign(velocityX) === Math.sign(dx);
  if (!far && !flicked) return null;
  return dx > 0 ? 'like' : 'pass';
}

/** Card rotation while dragging, in degrees. */
export function tilt(dx: number, cardWidth: number): number {
  if (cardWidth <= 0) return 0;
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, (dx / cardWidth) * MAX_TILT));
}
