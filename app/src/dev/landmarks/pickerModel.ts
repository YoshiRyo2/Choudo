/**
 * The landmark picker's pure parts: what order points are placed in, what each
 * is called, which comes next, and which sizes the live preview shows.
 */

import type { Garment, GarmentSize, TopLandmarkName } from '../../domain/garments/types';
import type { WarpPiece } from '../../ui/components/Mannequin/photoWarp';
import type { XY } from './suggest';

/**
 * The order points are placed in: round the shirt clockwise as you look at it,
 * starting at the collar. The outline polygon is drawn in the same order.
 */
export const PLACE_ORDER: readonly TopLandmarkName[] = [
  'collarLeft',
  'neckFront',
  'collarRight',
  'shoulderRight',
  'sleeveOuterRight',
  'sleeveInnerRight',
  'armpitRight',
  'hemRight',
  'hemLeft',
  'armpitLeft',
  'sleeveInnerLeft',
  'sleeveOuterLeft',
  'shoulderLeft',
];

/** Plain words for each point. "Left" and "right" are as you look at the photo. */
export const LANDMARK_LABELS: Record<TopLandmarkName, string> = {
  collarLeft: 'Collar, left: where the collar meets the shoulder',
  neckFront: 'Front neck: bottom of the front neckline',
  collarRight: 'Collar, right',
  shoulderRight: 'Shoulder, right: end of the shoulder seam',
  sleeveOuterRight: 'Sleeve opening, right: outer (upper) corner',
  sleeveInnerRight: 'Sleeve opening, right: inner (lower) corner',
  armpitRight: 'Armpit, right: where the sleeve meets the side',
  hemRight: 'Hem, right corner',
  hemLeft: 'Hem, left corner',
  armpitLeft: 'Armpit, left',
  sleeveInnerLeft: 'Sleeve opening, left: inner (lower) corner',
  sleeveOuterLeft: 'Sleeve opening, left: outer (upper) corner',
  shoulderLeft: 'Shoulder, left',
};

/** Short names for the list. */
export const SHORT_LABELS: Record<TopLandmarkName, string> = {
  collarLeft: 'Collar, left',
  neckFront: 'Front neck',
  collarRight: 'Collar, right',
  shoulderRight: 'Shoulder, right',
  sleeveOuterRight: 'Sleeve end, right, outer',
  sleeveInnerRight: 'Sleeve end, right, inner',
  armpitRight: 'Armpit, right',
  hemRight: 'Hem, right',
  hemLeft: 'Hem, left',
  armpitLeft: 'Armpit, left',
  sleeveInnerLeft: 'Sleeve end, left, inner',
  sleeveOuterLeft: 'Sleeve end, left, outer',
  shoulderLeft: 'Shoulder, left',
};

/** Where each point sits on the little guide diagram (viewBox 0 0 120 100), short sleeve. */
export const DIAGRAM: Record<TopLandmarkName, XY> = {
  collarLeft: { x: 50, y: 12 },
  neckFront: { x: 60, y: 22 },
  collarRight: { x: 70, y: 12 },
  shoulderRight: { x: 86, y: 18 },
  sleeveOuterRight: { x: 110, y: 40 },
  sleeveInnerRight: { x: 100, y: 50 },
  armpitRight: { x: 86, y: 40 },
  hemRight: { x: 86, y: 92 },
  hemLeft: { x: 34, y: 92 },
  armpitLeft: { x: 34, y: 40 },
  sleeveInnerLeft: { x: 20, y: 50 },
  sleeveOuterLeft: { x: 10, y: 40 },
  shoulderLeft: { x: 34, y: 18 },
};

/**
 * The point to place after `current`: the next unplaced one going round, or
 * simply the next one when all are placed (so clicking round re-places them).
 */
export function nextPoint(current: TopLandmarkName, placed: Partial<Record<TopLandmarkName, XY>>): TopLandmarkName {
  const at = PLACE_ORDER.indexOf(current);
  for (let k = 1; k <= PLACE_ORDER.length; k++) {
    const name = PLACE_ORDER[(at + k) % PLACE_ORDER.length]!;
    if (!placed[name]) return name;
  }
  return PLACE_ORDER[(at + 1) % PLACE_ORDER.length]!;
}

/** Room a made-up preview size adds over the only real one: about two sizes up. */
const PREVIEW_STEP = { chest: 10, waist: 10, length: 4, sleeve: 2, shoulder: 3 } as const;

/**
 * Two sizes to preview the warp on: the smallest and largest. A one-size garment
 * gets a made-up second size about two sizes bigger, for the preview only
 * (`madeUp` says which). Returns the garment with that size added, if any.
 */
export function previewSizes(garment: Garment): { garment: Garment; labels: [string, string]; madeUp: boolean } {
  const sizes = garment.sizes;
  if (sizes.length >= 2) {
    return { garment, labels: [sizes[0]!.label, sizes[sizes.length - 1]!.label], madeUp: false };
  }
  const only = sizes[0]!;
  const m = { ...only.measurements };
  for (const [k, add] of Object.entries(PREVIEW_STEP) as [keyof typeof PREVIEW_STEP, number][]) {
    if (m[k] !== undefined) m[k] = m[k]! + add;
  }
  const bigger: GarmentSize = { label: `${only.label} +2 sizes`, measurements: m, provenance: {} };
  return { garment: { ...garment, sizes: [only, bigger] }, labels: [only.label, bigger.label], madeUp: true };
}

/**
 * A warning when some warp pieces come out mirrored (see foldedPieces), naming
 * the landmarks involved so they can be moved; null when none do.
 */
export function foldWarning(folded: WarpPiece[]): string | null {
  if (!folded.length) return null;
  const names = new Set<string>();
  for (const p of folded) {
    for (const c of p.corners) {
      const landmark = (TOP_LANDMARK_SET as Set<string>).has(c) ? (c as TopLandmarkName) : null;
      names.add(landmark ? SHORT_LABELS[landmark] : c.startsWith('sleeve') ? 'a sleeve edge' : 'the centre line');
    }
  }
  return `The photo folds over (shows mirrored) between ${[...names].join(', ')}. Points there are out of order compared with the mannequin: for example a front neck below the shoulders, or a sleeve corner on the wrong side.`;
}

const TOP_LANDMARK_SET = new Set<string>(PLACE_ORDER);
