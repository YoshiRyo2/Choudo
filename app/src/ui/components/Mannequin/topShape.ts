/**
 * How a top hangs on the mannequin: size measurements (cm) -> SVG shapes (cm).
 *
 * A tee is modelled the way it behaves on a person, not as a scaled rectangle.
 * Cloth hangs: extra width falls downward into folds, it never sticks out.
 *  - The shoulder seam sits on the body's shoulder point while the chest ease is
 *    small, and slides down the upper arm as the size grows (a dropped
 *    shoulder). It never moves inward.
 *  - Sleeves hang from that seam down along the arm, a little looser and longer
 *    with each size. Short sleeves stop on the upper arm, barely flared.
 *  - The body falls nearly straight from the armpit to the hem. Spare width
 *    becomes soft vertical folds; sizes smaller than the body hug it and pull
 *    across the chest, drawn as light strain lines.
 *  - The hem sits at the garment's length from the high shoulder point, curving
 *    up a little at the sides.
 *  - Below the sleeves the arm is drawn again on top of the shirt body, because a
 *    relaxed arm hangs in front of the shirt's side seam.
 *
 * Pure functions, no React. Right side (+x) is built and mirrored for the left.
 */

import type { Garment, SizeMeasurements, TopLandmarkName } from '../../../domain/garments';
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
 * Spare fabric hangs in folds and round to the back, so a loose top looks much
 * narrower from the front than its circumference suggests. Fraction of the
 * extra flat width that still shows at the sides.
 */
const HANG = 0.6;
/** However big the size, no more than this much extra width shows at each side; the rest folds away. */
const MAX_SIDE_ROOM_CM = 7;
/** Room a sleeve leaves around the arm: a snug minimum, plus cm per cm of chest ease, capped. */
const SLEEVE_ROOM_MIN = 0.3;
const SLEEVE_ROOM_PER_EASE = 0.05;
const SLEEVE_ROOM_MAX = 3;
/** The most a side seam moves outward between the armpit and the hem (a hint of flare, never an A-line). */
export const MAX_SIDE_FLARE_CM = 1.2;
/** Short sleeves end at least this far above the elbow. */
const ELBOW_GAP_CM = 1;

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
  /**
   * Outline points matching a product photo's landmarks, for warping it onto this
   * size. "Right" is the +x side, as the viewer sees it. The armpits are the shirt
   * body's; `sleeveArmpits` are where each sleeve's own outline meets the body.
   */
  landmarks: Record<TopLandmarkName, Pt>;
  sleeveArmpits: { left: Pt; right: Pt };
  /** Right-side facts, for tests and debugging. */
  right: {
    seam: Pt;
    underarm: Pt;
    hem: Pt;
    /** Outer edge of the sleeve a little over halfway down it. */
    sleeveOuterMid: Pt;
    /** The two corners of the sleeve opening. */
    sleeveOuterEnd: Pt;
    sleeveInnerEnd: Pt;
    /** The shirt body's side seam, armpit to hem. */
    sideSeam: Pt[];
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
  const sideHalf = snug + Math.min(MAX_SIDE_ROOM_CM, Math.max(0, flatHalf - snug) * HANG);
  // A hint of flare toward the hem; most of the spare width hangs in folds.
  const flare = Math.min(MAX_SIDE_FLARE_CM - 0.2, room * 0.015);

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

  // The armhole deepens as the shoulder drops; short sleeves keep some length below it.
  const shortSleeveEnd = g.arm.elbowCm - ELBOW_GAP_CM;
  const underY = Math.min(g.y.armpit + 1.5 + drop * 0.8, g.arm.top.y + arm.dir.y * (shortSleeveEnd - 4));
  const sUnder = sAtY(underY);

  // Room around the arm. The sleeve also has to cover where the shirt body
  // meets it, so on big sizes it sits just outside the body's side seam.
  const sleevePad = Math.max(
    SLEEVE_ROOM_MIN + Math.min(SLEEVE_ROOM_MAX, room * SLEEVE_ROOM_PER_EASE),
    sideHalf + 1.5 - armEdge(sUnder, 1).x,
  );
  const innerTop: Pt = { ...innerEdge(sUnder), corner: true };

  // The seam sits on the body's shoulder point while there's no drop. As it
  // drops it moves onto the sleeve's outer edge down the arm, so the shoulder
  // line runs straight on into the sleeve. It can only move down and out.
  const onArm = Math.min(1, drop / 3);
  const seamOnArm = armEdge(drop, 1, sleevePad);
  const seam: Pt = {
    x: Math.max(g.half.shoulder + 0.3, lerp(g.half.shoulder + 0.3, seamOnArm.x, onArm)),
    y: Math.max(g.y.shoulder + 1.5, lerp(g.y.shoulder + 1.5, seamOnArm.y - 1, onArm)),
    corner: true,
  };

  const sleeveCm = long
    ? garment.sleeveDefinition === 'shoulder_to_cuff' && size.sleeve !== undefined
      ? size.sleeve
      : arm.len + 1 - drop
    : SHORT_SLEEVE_CM + room * 0.08;
  const sEnd = long
    ? Math.max(sUnder + 3, Math.min(drop + sleeveCm, arm.len * 1.06))
    : Math.min(Math.max(sUnder + 3, drop + sleeveCm), shortSleeveEnd);

  // Short sleeves open out a touch at the hem; long ones narrow to a cuff.
  const endPad = long ? 0.6 + Math.min(1, room * 0.02) : sleevePad + 0.3 + Math.min(1.2, room * 0.02);
  const padAt = (t: number) => lerp(sleevePad, endPad, t);
  const sAt = (t: number) => lerp(drop, sEnd, t);
  /** The sleeve's outer edge, `t` of the way from the seam to the opening. It runs down the arm. */
  const outerAt = (t: number): Pt => armEdge(sAt(t), 1, padAt(t));
  const outerEnd: Pt = { ...outerAt(1), corner: true };
  const outerMid = outerAt(0.6);
  const innerEnd: Pt = { ...innerEdge(sEnd), corner: true };
  const armhole: Pt = { x: lerp(innerTop.x, seam.x, 0.35), y: lerp(innerTop.y, seam.y, 0.6) };
  const sleeve = smoothPath(
    [{ ...seam, corner: false }, outerAt(0.25), outerMid, outerEnd, innerEnd, innerTop, armhole],
    true,
  );
  /** x of the sleeve's outer edge at height y (0 where there is no sleeve). */
  const sleeveOuterXAt = (y: number) => {
    if (y < seam.y || y > outerEnd.y) return 0;
    const pts = [seam, outerAt(0.25), outerMid, outerEnd];
    return xAt(pts, y);
  };

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
  // The side seam starts at the armpit and falls straight; the sleeve covers the join.
  const underarm: Pt = { x: sideHalf, y: underY };
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
  // from below the chest almost straight down to the hem.
  const folds: string[] = [];
  const foldCount = Math.min(4, Math.floor(room / 12));
  for (let i = 1; i <= foldCount; i++) {
    const reach = 0.3 + (0.6 * i) / (foldCount + 0.5);
    const x0 = sideHalf * reach;
    const top = lerp(underarm.y, hemY, i % 2 ? 0.18 : 0.38);
    const x1 = x0 + flare * reach * 0.5;
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
      neckFront: { x: 0, y: g.y.neckBase + necklineDip },
      shoulderRight: seam,
      shoulderLeft: mirrorPt(seam),
      armpitRight: underarm,
      armpitLeft: mirrorPt(underarm),
      hemRight: hem,
      hemLeft: mirrorPt(hem),
      sleeveOuterRight: outerEnd,
      sleeveOuterLeft: mirrorPt(outerEnd),
      sleeveInnerRight: innerEnd,
      sleeveInnerLeft: mirrorPt(innerEnd),
    },
    sleeveArmpits: { right: innerTop, left: mirrorPt(innerTop) },
    right: {
      seam,
      underarm,
      hem,
      sleeveOuterMid: outerMid,
      sleeveOuterEnd: outerEnd,
      sleeveInnerEnd: innerEnd,
      sideSeam: right.slice(3, right.length - 1),
      bodyHalfAtSleeveMid: xAt(right.slice(3), outerMid.y),
      sleeveEndCm: sEnd,
      sleeveEndT,
    },
    approximate,
  };
}
