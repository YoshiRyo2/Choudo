/**
 * The landmark picker's pure parts: what order points are placed in, what each
 * is called, which comes next, and which sizes the live preview shows.
 */

import { templateOf } from '../../domain/garments/categories';
import type { Garment, GarmentSize, LandmarkName, PantsLandmarkName, PhotoSide, TopBackLandmarkName, TopLandmarkName } from '../../domain/garments/types';
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

// ---------- pants ----------

/** Pants: round the outline clockwise as you look at it, from the band's left corner. */
export const PANTS_PLACE_ORDER: readonly PantsLandmarkName[] = [
  'waistLeft',
  'waistMid',
  'waistRight',
  'hipRight',
  'kneeOuterRight',
  'hemOuterRight',
  'hemInnerRight',
  'kneeInnerRight',
  'crotch',
  'kneeInnerLeft',
  'hemInnerLeft',
  'hemOuterLeft',
  'kneeOuterLeft',
  'hipLeft',
];

export const PANTS_LABELS: Record<PantsLandmarkName, string> = {
  waistLeft: 'Waistband, left: top corner',
  waistMid: 'Waistband, middle: top of the band at the centre front',
  waistRight: 'Waistband, right: top corner',
  hipRight: 'Hip, right: the widest point of the side, above the crotch',
  kneeOuterRight: 'Knee, right leg, outer edge: half way from the crotch to the hem',
  hemOuterRight: 'Hem, right leg, outer corner',
  hemInnerRight: 'Hem, right leg, inner corner',
  kneeInnerRight: 'Knee, right leg, inner edge',
  crotch: 'Crotch: where the two inner leg seams meet',
  kneeInnerLeft: 'Knee, left leg, inner edge',
  hemInnerLeft: 'Hem, left leg, inner corner',
  hemOuterLeft: 'Hem, left leg, outer corner',
  kneeOuterLeft: 'Knee, left leg, outer edge',
  hipLeft: 'Hip, left',
};

export const PANTS_SHORT_LABELS: Record<PantsLandmarkName, string> = {
  waistLeft: 'Waist, left',
  waistMid: 'Waist, middle',
  waistRight: 'Waist, right',
  hipRight: 'Hip, right',
  kneeOuterRight: 'Knee, right, outer',
  hemOuterRight: 'Hem, right, outer',
  hemInnerRight: 'Hem, right, inner',
  kneeInnerRight: 'Knee, right, inner',
  crotch: 'Crotch',
  kneeInnerLeft: 'Knee, left, inner',
  hemInnerLeft: 'Hem, left, inner',
  hemOuterLeft: 'Hem, left, outer',
  kneeOuterLeft: 'Knee, left, outer',
  hipLeft: 'Hip, left',
};

/** Where each pants point sits on the guide diagram (viewBox 0 0 120 100). */
export const PANTS_DIAGRAM: Record<PantsLandmarkName, XY> = {
  waistLeft: { x: 38, y: 6 },
  waistMid: { x: 60, y: 8 },
  waistRight: { x: 82, y: 6 },
  hipRight: { x: 86, y: 22 },
  kneeOuterRight: { x: 84, y: 60 },
  hemOuterRight: { x: 84, y: 96 },
  hemInnerRight: { x: 66, y: 96 },
  kneeInnerRight: { x: 66, y: 60 },
  crotch: { x: 60, y: 32 },
  kneeInnerLeft: { x: 54, y: 60 },
  hemInnerLeft: { x: 54, y: 96 },
  hemOuterLeft: { x: 36, y: 96 },
  kneeOuterLeft: { x: 36, y: 60 },
  hipLeft: { x: 34, y: 22 },
};

/** Everything the picker page needs for one template: what to place, in what order, and how to name it. */
export interface PickerKit<N extends LandmarkName = LandmarkName> {
  order: readonly N[];
  labels: Record<N, string>;
  short: Record<N, string>;
  diagram: Record<N, XY>;
  /** The guide diagram's garment outline (viewBox 0 0 120 100). */
  diagramPath: string;
}

export const PICKER_KITS = {
  top: {
    order: PLACE_ORDER,
    labels: LANDMARK_LABELS,
    short: SHORT_LABELS,
    diagram: DIAGRAM,
    diagramPath: 'M50 12 Q60 24 70 12 L86 18 L110 40 L100 50 L86 40 L86 92 L34 92 L34 40 L20 50 L10 40 L34 18 Z',
  } satisfies PickerKit<TopLandmarkName>,
  pants: {
    order: PANTS_PLACE_ORDER,
    labels: PANTS_LABELS,
    short: PANTS_SHORT_LABELS,
    diagram: PANTS_DIAGRAM,
    diagramPath: 'M38 6 L60 8 L82 6 L86 22 L84 96 L66 96 L60 32 L54 96 L36 96 L34 22 Z',
  } satisfies PickerKit<PantsLandmarkName>,
};

/** A back photo of a top: the front's points with the back neck in place of the front neck. */
const backOf = <T,>(r: Record<TopLandmarkName, T>, neckBack: T): Record<TopBackLandmarkName, T> => {
  const { neckFront: _front, ...rest } = r;
  return { ...rest, neckBack };
};
export const TOP_BACK_KIT: PickerKit<TopBackLandmarkName> = {
  order: PLACE_ORDER.map((n) => (n === 'neckFront' ? 'neckBack' : n)),
  labels: backOf(LANDMARK_LABELS, 'Back neck: bottom of the back neckline'),
  short: backOf(SHORT_LABELS, 'Back neck'),
  diagram: backOf(DIAGRAM, { x: 60, y: 15 }),
  diagramPath: 'M50 12 Q60 17 70 12 L86 18 L110 40 L100 50 L86 40 L86 92 L34 92 L34 40 L20 50 L10 40 L34 18 Z',
};

/** The picker kit for a garment's template and the side photographed (pants look the same from both). */
export const kitFor = (garment: Pick<Garment, 'type'>, side: PhotoSide = 'front'): PickerKit =>
  (templateOf(garment) === 'pants' ? PICKER_KITS.pants : side === 'back' ? TOP_BACK_KIT : PICKER_KITS.top) as PickerKit;

/**
 * The point to place after `current`: the next unplaced one going round, or
 * simply the next one when all are placed (so clicking round re-places them).
 */
export function nextPoint<N extends LandmarkName = TopLandmarkName>(
  current: NoInfer<N>,
  placed: Partial<Record<NoInfer<N>, XY>>,
  order: readonly N[] = PLACE_ORDER as readonly LandmarkName[] as readonly N[],
): N {
  const at = order.indexOf(current);
  for (let k = 1; k <= order.length; k++) {
    const name = order[(at + k) % order.length]!;
    if (!placed[name]) return name;
  }
  return order[(at + 1) % order.length]!;
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
  const short: Record<string, string> = { ...SHORT_LABELS, ...PANTS_SHORT_LABELS };
  for (const p of folded) {
    for (const c of p.corners) {
      names.add(short[c] ?? (c.startsWith('sleeve') ? 'a sleeve edge' : c.startsWith('leg') ? 'a leg edge' : 'the centre line'));
    }
  }
  return `The photo folds over (shows mirrored) between ${[...names].join(', ')}. Points there are out of order compared with the mannequin: for example a front neck below the shoulders, or a sleeve corner on the wrong side.`;
}

