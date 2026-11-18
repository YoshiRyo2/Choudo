/**
 * How a top hangs on the mannequin: size measurements (cm) -> SVG shapes (cm).
 *
 * A tee is modelled the way it behaves on a person, not as a scaled rectangle:
 *  - The shoulder seam sits on the body's shoulder point while the chest ease is
 *    small, and slides down and out along the upper arm as the size grows
 *    (a dropped shoulder). It never moves inward.
 *  - Sleeves hang from that seam around the arm. They get wider and longer with
 *    the size, swing a little away from the body on big sizes, and short sleeves
 *    stop on the upper arm with a slight flare.
 *  - The body hangs straight from the shoulders. Width beyond the body becomes
 *    vertical folds and slightly flared side seams; sizes smaller than the body
 *    pull tight across the chest, drawn as strain lines.
 *  - The hem sits at the garment's length from the high shoulder point, curving
 *    up a little at the sides.
 *  - Below the sleeves the arm is drawn again on top of the shirt body, because a
 *    relaxed arm hangs in front of the shirt's side seam.
 *
 * Pure functions, no React. Right side (+x) is built and mirrored for the left.
 */

import type { Garment, SizeMeasurements } from '../../../domain/garments';
import {
  bodyHalfAt,
  halfWidth,
  lerp,
  limbFrame,
  limbHalf,
  limbPath,
  mirrorPath,
  smoothPath,
  type BodyGeometry,
  type Marker,
  type Pt,
  xAt,
} from './geometry';

/** Short sleeve length from the shoulder seam, for a size with no extra chest room. */
const SHORT_SLEEVE_CM = 19;
/** Garment length is measured over the body, so it hangs a little shorter. */
const DRAPE = 0.97;
/** Chest ease (cm of circumference) a tee carries before its shoulder seam starts to drop. */
const DROP_START_CM = 10;
/** How far the seam slides down the arm per cm of chest ease beyond that. */
const DROP_PER_EASE = 0.22;
/** The seam never drops more than this fraction of the arm. */
const MAX_DROP = 0.28;
/**
 * Spare fabric hangs in folds, so a loose top looks narrower from the front than
 * its circumference would suggest. Fraction of the extra width that still shows.
 */
const HANG = 0.8;
/**
 * A tee's sleeve opening is about a third of its flat chest width. Hanging round
 * the arm, the sleeve shows roughly this fraction of the chest circumference
 * from the front.
 */
const SLEEVE_PER_CHEST = 0.12;
/** Short sleeves end at least this far above the elbow. */
const ELBOW_GAP_CM = 1;

/** Named outline points, for warping a product photo onto the drawn shape. */
export type TopLandmark =
  | 'collarLeft'
  | 'collarRight'
  | 'shoulderLeft'
  | 'shoulderRight'
  | 'armpitLeft'
  | 'armpitRight'
  | 'hemLeft'
  | 'hemRight';

export interface TopShape {
  body: string;
  sleeves: [string, string];
  /** The arm below each sleeve, drawn over the shirt body. */
  arms: [string, string];
  /** Vertical folds from spare width. Open paths, stroke only. */
  folds: string[];
  /** Pull lines across the chest when the size is smaller than the body. */
  strain: string[];
  /** Where to pin each zone's fit marker. */
  markers: Partial<Record<'chest' | 'waist' | 'length' | 'sleeve', Marker>>;
  /** Outline points, as the viewer sees them: "Right" is the +x side. */
  landmarks: Record<TopLandmark, Pt>;
  /** Right-side facts, for tests and debugging. */
  right: {
    seam: Pt;
    underarm: Pt;
    hem: Pt;
    /** Outer edge of the sleeve halfway down it. */
    sleeveOuterMid: Pt;
    /** Garment body half-width at the same height as sleeveOuterMid. */
    bodyHalfAtSleeveMid: number;
    /** Where the sleeve ends, in cm down the arm. */
    sleeveEndCm: number;
    /** Where the sleeve ends, as a fraction of the arm (0 = shoulder, 1 = wrist). */
    sleeveEndT: number;
  };
  /** True when we couldn't trust the chart's girths, so the drawn width is a guess. */
  approximate: boolean;
}

export function topShape(
  g: BodyGeometry,
  garment: Garment,
  size: SizeMeasurements,
  bodyChestCm: number,
): TopShape {
  const approximate = !garment.girthVerified || size.chest === undefined;
  const chestCirc = approximate ? bodyChestCm * 1.08 : size.chest!;
  const ease = chestCirc - bodyChestCm;
  const room = Math.max(0, ease);
  const arm = limbFrame(g.arm);

  // ----- shoulder seam: on the shoulder point, then down the arm as the size grows -----
  const chartDrop = size.shoulder !== undefined ? size.shoulder / 2 - g.half.shoulder : 0;
  const drop = Math.min(Math.max(0, chartDrop, (ease - DROP_START_CM) * DROP_PER_EASE), arm.len * MAX_DROP);

  // ----- body width -----
  const flatHalf = halfWidth.chest(chestCirc);
  const snug = g.half.chest + 0.3;
  const sideHalf = flatHalf <= snug ? snug : snug + (flatHalf - snug) * HANG;
  const flare = Math.min(3.5, room * 0.05);

  // ----- sleeve -----
  // `s` is cm down the arm from its top; the arm hangs almost straight down.
  const axis = (s: number): Pt => ({ x: g.arm.top.x + arm.dir.x * s, y: g.arm.top.y + arm.dir.y * s });
  const armHalf = (s: number) => limbHalf(g.arm, s / arm.len);
  const sAtY = (y: number) => (y - g.arm.top.y) / arm.dir.y;
  /** A point on the arm's outer (+1) or inner (−1) edge, `pad` cm further out. */
  const armEdge = (s: number, side: 1 | -1, pad = 0): Pt => {
    const p = axis(s);
    const w = armHalf(s) + pad;
    return { x: p.x + side * arm.normal.x * w, y: p.y + side * arm.normal.y * w };
  };
  // The sleeve's inner edge runs down the inside of the arm, but never further
  // in than the side of the chest.
  const innerEdge = (s: number): Pt => {
    const p = armEdge(s, -1, 0.3);
    return { x: Math.max(p.x, g.half.chest - 1), y: p.y };
  };

  const long = garment.sleeve === 'long';
  const sleeveWidth = Math.max(2 * armHalf(drop + 10) + 2, SLEEVE_PER_CHEST * chestCirc);

  const seam: Pt = (() => {
    const p = armEdge(drop, 1, 0.4);
    // Never inside the body's own shoulder point.
    return { x: Math.max(p.x, g.half.shoulder + 0.4), y: Math.max(p.y, g.y.shoulder + 1.5), corner: true };
  })();

  // The underarm sits low enough for the armhole to be as wide as the sleeve.
  const shortSleeveEnd = g.arm.elbowCm - ELBOW_GAP_CM;
  const armholeWidth = long ? sleeveWidth : sleeveWidth * 0.95;
  let underY = g.y.armpit + 1.5 + drop * 0.6;
  const dx = seam.x - innerEdge(sAtY(underY)).x;
  underY = Math.max(underY, seam.y + Math.sqrt(Math.max(0, armholeWidth ** 2 - dx ** 2)));
  underY = Math.min(underY, g.arm.top.y + arm.dir.y * (shortSleeveEnd - 4));
  const sUnder = sAtY(underY);
  const innerTop: Pt = { ...innerEdge(sUnder), corner: true };

  const sleeveCm = long
    ? garment.sleeveDefinition === 'shoulder_to_cuff' && size.sleeve !== undefined
      ? size.sleeve
      : arm.len + 1 - drop
    : SHORT_SLEEVE_CM + room * 0.08;
  const sEnd = long
    ? Math.max(sUnder + 3, Math.min(drop + sleeveCm, arm.len * 1.06))
    : Math.min(Math.max(sUnder + 3, drop + sleeveCm), shortSleeveEnd);

  // Short sleeves flare slightly to their opening; long ones taper to the cuff.
  const cuffWidth = long ? Math.max(2 * armHalf(sEnd) + 1.6, sleeveWidth * 0.55) : sleeveWidth;
  const innerEnd: Pt = { ...innerEdge(sEnd), corner: true };
  const outerEnd: Pt = {
    x: Math.max(innerEnd.x + arm.normal.x * cuffWidth, armEdge(sEnd, 1, 0.8).x),
    y: innerEnd.y + arm.normal.y * cuffWidth,
    corner: true,
  };
  const along = (t: number, bulge: number): Pt => {
    const p = { x: lerp(seam.x, outerEnd.x, t), y: lerp(seam.y, outerEnd.y, t) };
    return { x: p.x + arm.normal.x * bulge, y: p.y + arm.normal.y * bulge };
  };
  // Hanging cloth makes a bell: the outer edge leaves the seam close to the arm
  // and flares toward the opening, so the sleeve carries on from the shoulder.
  const bell = Math.min(2.5, Math.max(0, outerEnd.x - seam.x) * 0.12);
  const outerMid = along(0.6, -bell * 0.6);
  const armhole: Pt = { x: lerp(innerTop.x, seam.x, 0.35), y: lerp(innerTop.y, seam.y, 0.6) };
  const sleeve = smoothPath(
    [{ ...seam, corner: false }, along(0.25, -bell), outerMid, outerEnd, innerEnd, innerTop, armhole],
    true,
  );
  const sleeveOuterX = (y: number) =>
    y <= seam.y ? seam.x : y >= outerEnd.y ? outerEnd.x : lerp(seam.x, outerEnd.x, (y - seam.y) / (outerEnd.y - seam.y));

  // ----- body outline (right side, top to bottom) -----
  const lengthCm = size.length ?? g.y.hip - g.y.hps;
  const hemY = g.y.hps + lengthCm * DRAPE;
  const hemLift = 0.8 + room * 0.01; // the hem curves up a little at the side seams
  const sideAt = (y: number, extra: number) => Math.max(sideHalf + extra, bodyHalfAt(g, y) + 0.6);
  const waistHalf =
    !approximate && size.waist !== undefined
      ? Math.max(snug + (halfWidth.waist(size.waist) - snug) * HANG, bodyHalfAt(g, g.y.waist) + 0.6)
      : sideAt(g.y.waist, flare * 0.3);

  const collar: Pt = { x: g.half.neck + 0.8, y: g.y.hps, corner: true };
  // Tucked under the sleeve, so the body never pokes out above it.
  const underarm: Pt = { x: Math.min(sideHalf, sleeveOuterX(innerTop.y) - 1), y: innerTop.y };
  const hem: Pt = { x: sideAt(hemY, flare) + 0.2, y: hemY - hemLift, corner: true };
  const right: Pt[] = [
    collar,
    // Just outside the body's shoulder curve, so the shoulder line never dips into it.
    { x: g.half.shoulder - 1, y: g.y.shoulder - 0.3 },
    { ...seam, corner: false },
    underarm,
  ];
  const sides: Pt[] = [
    { x: sideHalf, y: Math.max(g.y.chest, underarm.y + 3) },
    { x: waistHalf, y: g.y.waist },
    { x: sideAt(g.y.hip, flare * 0.6), y: g.y.hip },
  ];
  for (const p of sides) {
    if (p.y > right[right.length - 1]!.y + 1.5 && p.y < hem.y - 2) right.push(p);
  }
  right.push(hem, { x: hem.x * 0.55, y: hemY - hemLift * 0.15 });

  const left = [...right].reverse().map((p) => ({ ...p, x: -p.x }));
  const necklineDip = garment.type === 'button-up' || garment.type === 'polo' ? 1.5 : 3.5;
  const body = smoothPath(
    [...right, { x: 0, y: hemY }, ...left, { x: 0, y: g.y.neckBase + necklineDip }],
    true,
  );

  // ----- folds and strain -----
  // Spare width falls into a few soft vertical folds of uneven length, hanging
  // from below the chest and fanning out a little toward the hem.
  const folds: string[] = [];
  const spare = sideHalf - g.half.chest;
  const foldCount = Math.min(3, Math.floor(spare / 3));
  for (let i = 1; i <= foldCount; i++) {
    const reach = 0.35 + (0.55 * i) / (foldCount + 0.5);
    const x0 = sideHalf * reach;
    const top = lerp(underarm.y, hemY, i % 2 ? 0.22 : 0.4);
    const x1 = x0 + flare * reach;
    folds.push(
      smoothPath(
        [
          { x: x0, y: top },
          { x: lerp(x0, x1, 0.5) + (i % 2 ? 0.4 : -0.4), y: lerp(top, hemY, 0.55) },
          { x: x1, y: hemY - hemLift * reach - 0.4 },
        ],
        false,
      ),
    );
  }

  const strain: string[] = [];
  const pull = -ease;
  if (pull > 0) {
    const lines = Math.min(3, Math.ceil(pull / 2.5));
    for (let i = 0; i < lines; i++) {
      const fromY = Math.max(g.y.armpit, underarm.y) + 0.5 + i * 2.2;
      const len = 3.5 + pull * 0.35 - i * 0.6;
      strain.push(
        smoothPath(
          [
            { x: sideHalf - 0.5, y: fromY },
            { x: sideHalf - 0.5 - len * 0.55, y: fromY - 0.9 + i * 0.6 },
            { x: sideHalf - 0.5 - len, y: fromY - 1.2 + i * 1.3 },
          ],
          false,
        ),
      );
    }
  }
  const mirrorAll = (paths: string[]) => [...paths, ...paths.map(mirrorPath)];

  // ----- the arm below the sleeve -----
  const sleeveEndT = sEnd / arm.len;
  const forearm = limbPath(g.arm, Math.min(sleeveEndT - 0.04, 1.02), 1.1, 0, 0);

  // ----- markers -----
  const sleeveOuterXAt = (y: number) =>
    y >= seam.y && y <= outerEnd.y ? lerp(seam.x, outerEnd.x, (y - seam.y) / (outerEnd.y - seam.y || 1)) : 0;
  const mirrorPt = (p: Pt): Pt => ({ x: -p.x, y: p.y });

  return {
    body,
    sleeves: [sleeve, mirrorPath(sleeve)],
    arms: [forearm, mirrorPath(forearm)],
    folds: mirrorAll(folds),
    strain: mirrorAll(strain),
    markers: {
      chest: { x: Math.max(sideHalf, sleeveOuterXAt(g.y.chest)), y: g.y.chest },
      waist: { x: waistHalf, y: g.y.waist },
      length: { x: hem.x, y: hemY },
      sleeve: { x: outerEnd.x + 1, y: outerEnd.y },
    },
    landmarks: {
      collarRight: collar,
      collarLeft: mirrorPt(collar),
      shoulderRight: seam,
      shoulderLeft: mirrorPt(seam),
      armpitRight: underarm,
      armpitLeft: mirrorPt(underarm),
      hemRight: hem,
      hemLeft: mirrorPt(hem),
    },
    right: {
      seam,
      underarm,
      hem,
      sleeveOuterMid: outerMid,
      bodyHalfAtSleeveMid: xAt(right.slice(3), outerMid.y),
      sleeveEndCm: sEnd,
      sleeveEndT,
    },
    approximate,
  };
}
