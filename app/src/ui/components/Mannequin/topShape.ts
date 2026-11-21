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
 * Knits (hoodies, sweatshirts) are the same shape with knit details on the
 * surface: a rib hem band gathered to the chart's hem band, rib cuffs gathered
 * at the wrist, and on a hoodie the hood lying behind the neck. Their length and
 * centre-back sleeve are placed by the fit engine's own conversions
 * (domain/fit/tops.ts), so the drawing and the readout agree.
 *
 * Pure functions, no React. Right side (+x) is built and mirrored for the left.
 */

import type { BodyMeasurements } from '../../../domain/body';
import { hpsLengthCm, sleeveFromShoulderPointCm } from '../../../domain/fit/tops';
import { girthKnown, templateOf, type Garment, type SizeMeasurements, type TopLandmarkName } from '../../../domain/garments';
import { SLEEVE_STRIPS, type SleeveEdges } from './photoWarp';
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
export const DRAPE = 0.97;
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
/** Knit details, skin only: how tall the rib hem band and the rib cuffs are drawn. */
export const RIB_HEM_CM = 6;
export const RIB_CUFF_CM = 6;
/** A rib cuff hugs the wrist: this much room around the arm. */
const CUFF_PAD_CM = 0.5;
/** A hood lying down shows this far above the high shoulder point, behind the neck (never up to the chin). */
const HOOD_RISE_CM = 5;
/** Rib lines are drawn this far apart. */
const RIB_PITCH_CM = 1.4;

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
  markers: Partial<Record<'chest' | 'waist' | 'length' | 'sleeve' | 'hemBand', Marker>>;
  /** Knits: the rib hem band (closed path, from `hemTopY` to the hem), rib cuffs on long sleeves, and rib lines. */
  rib?: { hem: string; hemTopY: number; cuffs: string[]; lines: string[] };
  /** Hoodies: the hood lying behind the neck (drawn behind the body), its front edge and drawcords (stroke only). */
  hood?: { back: string; edges: string[]; cords: string[] };
  /** Hoodies: the top of the hood, matching a photo's optional hoodTop landmark. */
  hoodTop?: Pt;
  /**
   * Outline points matching a product photo's landmarks, for warping it onto this
   * size. "Right" is the +x side, as the viewer sees it. The armpits are the shirt
   * body's; `sleeveArmpits` are where each sleeve's own outline meets the body.
   */
  landmarks: Record<TopLandmarkName, Pt>;
  sleeveArmpits: { left: Pt; right: Pt };
  /** Each sleeve's outer and inner edge, root to opening, for warping the photo's sleeves strip by strip. */
  sleeveEdges: { left: SleeveEdges; right: SleeveEdges };
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
  /** Needed to place a centre-back sleeve (the engine's conversion); without it the sleeve is drawn to the wrist. */
  bodyM?: Pick<BodyMeasurements, 'shoulderWidthCm' | 'bodyType'>,
): TopShape {
  const knit = templateOf(garment) === 'knit';
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
  // A centre-back sleeve is placed from the body's shoulder point, as the fit engine compares it.
  const fromShoulderPoint = long && bodyM ? sleeveFromShoulderPointCm(garment, size, bodyM) : undefined;
  const sEnd = long
    ? Math.max(sUnder + 3, Math.min(fromShoulderPoint ?? drop + sleeveCm, arm.len * 1.06))
    : Math.min(Math.max(sUnder + 3, drop + sleeveCm), shortSleeveEnd);

  // Short sleeves open out a touch at the hem; long ones narrow to a cuff.
  const endPad = long ? 0.6 + Math.min(1, room * 0.02) : sleevePad + 0.3 + Math.min(1.2, room * 0.02);
  // A knit's long sleeve keeps its room down to the rib cuff, which then hugs the wrist.
  const cuffed = knit && long;
  const cuffT = cuffed ? Math.max(0.7, 1 - RIB_CUFF_CM / Math.max(1e-6, sEnd - drop)) : 1;
  const padAt = (t: number) => (cuffed ? (t < cuffT ? sleevePad : CUFF_PAD_CM) : lerp(sleevePad, endPad, t));
  const sAt = (t: number) => lerp(drop, sEnd, t);
  /** The sleeve's outer edge, `t` of the way from the seam to the opening. It runs down the arm. */
  const outerAt = (t: number): Pt => armEdge(sAt(t), 1, padAt(t));
  const outerEnd: Pt = { ...outerAt(1), corner: true };
  const outerMid = outerAt(0.6);
  const innerEnd: Pt = { ...innerEdge(sEnd), corner: true };
  const armhole: Pt = { x: lerp(innerTop.x, seam.x, 0.35), y: lerp(innerTop.y, seam.y, 0.6) };
  const cuffTopOuter: Pt = { ...armEdge(sAt(cuffT), 1, CUFF_PAD_CM), corner: true };
  const cuffTopInner: Pt = { ...innerEdge(sAt(cuffT)), corner: true };
  const sleeve = smoothPath(
    cuffed
      ? [{ ...seam, corner: false }, outerAt(0.25), outerMid, outerAt(cuffT - 0.04), cuffTopOuter, outerEnd, innerEnd, innerTop, armhole]
      : [{ ...seam, corner: false }, outerAt(0.25), outerMid, outerEnd, innerEnd, innerTop, armhole],
    true,
  );
  /** x of the sleeve's outer edge at height y (0 where there is no sleeve). */
  const sleeveOuterXAt = (y: number) => {
    if (y < seam.y || y > outerEnd.y) return 0;
    const pts = [seam, outerAt(0.25), outerMid, outerEnd];
    return xAt(pts, y);
  };

  // ----- body outline (right side, top to bottom) -----
  // A centre-back length is hung from the high shoulder point, as the fit engine compares it.
  const lengthCm = hpsLengthCm(garment, size) ?? size.length ?? g.y.hip - g.y.hps;
  const hemY = g.y.hps + lengthCm * DRAPE;
  // The hem curves up a little at the side seams; a rib band runs straight.
  const hemLift = knit ? 0 : 0.8 + room * 0.01;
  const bandTopY = hemY - RIB_HEM_CM;
  const sideAt = (y: number, extra: number) => Math.max(sideHalf + extra, bodyHalfAt(g, y) + 0.6);
  const waistHalf =
    !approximate && size.waist !== undefined
      ? Math.max(snug + (halfWidth.waist(size.waist) - snug) * HANG, bodyHalfAt(g, g.y.waist) + 0.6)
      : sideAt(g.y.waist, flare * 0.3);

  const collar: Pt = { x: g.half.neck + 0.8, y: g.y.hps, corner: true };
  // The side seam starts at the armpit and falls straight; the sleeve covers the join.
  const underarm: Pt = { x: sideHalf, y: underY };
  // A rib band gathers to the chart's hem band, stretched onto the body where it's
  // smaller than the body; it never stands out past the sweatshirt above it.
  // Without a hem band on the chart it's drawn at the body's own width.
  const hug = bodyHalfAt(g, hemY) + 0.3;
  const chartBand =
    size.hemBand !== undefined && girthKnown(garment, 'hemBand') ? halfWidth.hips(size.hemBand) : undefined;
  const bandHalf = Math.min(Math.max(chartBand ?? sideHalf, hug), Math.max(sideHalf, hug));
  const hem: Pt = knit
    ? { x: bandHalf, y: hemY, corner: true }
    : { x: sideAt(hemY, flare) + 0.2, y: hemY - hemLift, corner: true };
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
  const lowest = knit ? bandTopY - 1.5 : hem.y - 2;
  for (const p of sides) {
    if (p.y > right[right.length - 1]!.y + 1.5 && p.y < lowest) right.push(p);
  }
  if (knit) {
    // The body blouses a little over the band, then steps in to it.
    right.push({ x: Math.max(sideAt(bandTopY, flare * 0.8), bandHalf), y: bandTopY - 0.6 }, { x: bandHalf, y: bandTopY, corner: true });
  }
  right.push(hem, { x: hem.x * 0.55, y: hemY - hemLift * 0.15 });

  const left = [...right].reverse().map((p) => ({ ...p, x: -p.x }));
  const necklineDip = ['button-up', 'polo', 'jacket', 'coat'].includes(garment.type) ? 1.5 : 3.5;
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
          { x: x1, y: (knit ? bandTopY : hemY) - hemLift * reach - 0.4 },
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

  // ----- knit details: rib hem band and cuffs, hood -----
  const mirrorPt = (p: Pt): Pt => ({ x: -p.x, y: p.y });
  const ribLines = (from: Pt, to: Pt, across: Pt, halfCount: number): string[] =>
    Array.from({ length: halfCount * 2 + 1 }, (_, k) => {
      const o = (k - halfCount) * RIB_PITCH_CM;
      return smoothPath(
        [
          { x: from.x + across.x * o, y: from.y + across.y * o },
          { x: to.x + across.x * o, y: to.y + across.y * o },
        ],
        false,
      );
    });
  let rib: TopShape['rib'];
  if (knit) {
    const cuffs: string[] = [];
    const lines = ribLines({ x: 0, y: bandTopY + 0.4 }, { x: 0, y: hemY - 0.4 }, { x: 1, y: 0 }, Math.floor((bandHalf - 0.5) / RIB_PITCH_CM));
    if (cuffed) {
      const cuff = smoothPath([cuffTopOuter, outerEnd, innerEnd, cuffTopInner], true);
      cuffs.push(cuff, mirrorPath(cuff));
      const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const top = mid(cuffTopOuter, cuffTopInner);
      const bottom = mid(outerEnd, innerEnd);
      const n = Math.max(1, Math.floor(Math.hypot(cuffTopOuter.x - cuffTopInner.x, cuffTopOuter.y - cuffTopInner.y) / 2 / RIB_PITCH_CM));
      const cuffLines = ribLines(top, bottom, arm.normal, n);
      lines.push(...cuffLines, ...cuffLines.map(mirrorPath));
    }
    const hemBand = smoothPath(
      [
        { x: bandHalf, y: bandTopY, corner: true },
        { x: bandHalf, y: hemY, corner: true },
        { x: -bandHalf, y: hemY, corner: true },
        { x: -bandHalf, y: bandTopY, corner: true },
      ],
      true,
    );
    rib = { hem: hemBand, hemTopY: bandTopY, cuffs, lines };
  }

  // A hood lying down: drawn behind the body, so the neck hides its middle and it
  // shows either side of the neck, above the shoulders. Its front edge runs into the
  // neckline, with two drawcords. Shape only; the body sets where it sits.
  let hood: TopShape['hood'];
  let hoodTop: Pt | undefined;
  if (garment.type === 'hoodie') {
    hoodTop = { x: 0, y: Math.max(g.y.hps - HOOD_RISE_CM, g.y.chin + 1.5) };
    const outer = collar.x + 3.5;
    const backRight: Pt[] = [
      { x: outer, y: g.y.hps + 2 },
      { x: outer + 0.4, y: lerp(hoodTop.y, g.y.hps, 0.45) },
      { x: collar.x + 1.2, y: hoodTop.y + 0.8 },
    ];
    const back = smoothPath([...backRight, hoodTop, ...[...backRight].reverse().map(mirrorPt)], true);
    const neckFrontY = g.y.neckBase + necklineDip;
    const edge = smoothPath([collar, { x: collar.x * 0.55, y: lerp(collar.y, neckFrontY, 0.7) }, { x: 0.6, y: neckFrontY + 0.4 }], false);
    const cord = smoothPath(
      [
        { x: 1.6, y: neckFrontY - 0.5 },
        { x: 1.9, y: neckFrontY + 8 },
        { x: 2.3, y: neckFrontY + 16 },
      ],
      false,
    );
    hood = { back, edges: [edge, mirrorPath(edge)], cords: [cord, mirrorPath(cord)] };
  }

  // ----- markers -----
  // Sleeve edges at even steps from root to opening, matching the drawn outline's ends.
  const steps = Array.from({ length: SLEEVE_STRIPS + 1 }, (_, k) => k / SLEEVE_STRIPS);
  const rightEdges: SleeveEdges = {
    outer: steps.map((t) => (t === 0 ? seam : t === 1 ? outerEnd : outerAt(t))),
    inner: steps.map((t) => (t === 0 ? innerTop : t === 1 ? innerEnd : innerEdge(lerp(sUnder, sEnd, t)))),
  };
  const mirrorEdges = (e: SleeveEdges): SleeveEdges => ({ outer: e.outer.map(mirrorPt), inner: e.inner.map(mirrorPt) });

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
      ...(knit ? { hemBand: { x: hem.x, y: bandTopY + 1 } } : {}),
    },
    ...(rib ? { rib } : {}),
    ...(hood ? { hood } : {}),
    ...(hoodTop ? { hoodTop } : {}),
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
    sleeveEdges: { right: rightEdges, left: mirrorEdges(rightEdges) },
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
