/**
 * The pants template: a pair of trousers drawn over the body, from the body's own
 * heights and the size chart. Pure; no React.
 *
 * Skin rule: every height and width here is a number the domain produced. The band
 * sits at bandHeight() (the same function the fit compares the waist at); the
 * thigh, knee and opening widths are the chart's girths through halfWidth. Only
 * when the chart lacks one do we fall back to a typical width, and then the
 * garment is drawn dashed (`approximate`), like a top with an unverified girth.
 */

import type { BodyMeasurements } from '../../../../domain/body';
import { bandHeight, riseForBand } from '../../../../domain/fit';
import { girthKnown, type Garment, type GarmentType, type PantsLandmarkName, type SizeMeasurements } from '../../../../domain/garments';
import { bodyHalfAt, halfWidth, lerp, smoothPath, type BodyGeometry, type Marker, type Pt } from '../geometry';
import { SLEEVE_STRIPS, type SleeveEdges, type XY } from '../photoWarp';

export interface BottomShape {
  body: string;
  markers: Partial<Record<'waist' | 'hips' | 'thigh' | 'rise' | 'inseam' | 'legOpening', Marker>>;
  /** Each leg's outer edge (hip → knee → hem) and inner edge (crotch → knee → hem), SLEEVE_STRIPS + 1 points each, for the photo warp's leg strips. */
  limbEdges: { left: SleeveEdges; right: SleeveEdges };
  /** Each leg's own outline (its strips' clip), so a leg's photo never spills onto the other leg. */
  legs: { left: string; right: string };
  /** Drawn points matching a pants photo's landmarks, for the warp. */
  landmarks: Record<PantsLandmarkName, Pt>;
  /** The hem would reach past the floor — drawn bunched at the ankle. */
  pooled: boolean;
  /** Some width is a fallback, not the chart's: drawn dashed. */
  approximate: boolean;
}

/** Half the leg opening (cm, front view) by cut, used only when the chart has no leg opening. */
export const HEM_HALF: Record<GarmentType, number> = {
  jeans: 9.5,
  chinos: 9,
  joggers: 6.5,
  trousers: 12.5,
  tee: 9,
  'long-sleeve-tee': 9,
  polo: 9,
  'button-up': 9,
};

/** How much wider than the leg under it a fallback thigh or knee is drawn (cm, half width). Skin only. */
const FALLBACK_ROOM_CM = 2;
/** A leg is never drawn closer to the body than this (cm, half width). */
const MIN_ROOM_CM = 0.3;

const mirrorX = (p: XY): XY => ({ x: -p.x, y: p.y });

/** Points along a two-segment edge (top → knee → hem), the knee always at the middle index. */
function edge(top: XY, knee: XY, hem: XY): XY[] {
  const half = SLEEVE_STRIPS / 2;
  return Array.from({ length: SLEEVE_STRIPS + 1 }, (_, k) => {
    const [a, b, t] = k <= half ? [top, knee, k / half] : [knee, hem, (k - half) / half];
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  });
}

export function pantsShape(g: BodyGeometry, body: BodyMeasurements, garment: Garment, size: SizeMeasurements): BottomShape {
  // A girth we can draw from the chart: present, and its method known.
  const chartGirth = (key: 'waist' | 'hips' | 'thigh' | 'knee' | 'legOpening') =>
    size[key] !== undefined && girthKnown(garment, key) ? size[key] : undefined;
  const [waist, hips, thigh, knee, opening] = (['waist', 'hips', 'thigh', 'knee', 'legOpening'] as const).map(chartGirth);
  const approximate = !garment.girthVerified || thigh === undefined || knee === undefined || opening === undefined;

  // The band where the fit engine says it sits.
  const bandY = g.height - bandHeight(body, riseForBand(garment, size));
  const bandHalf = Math.max(waist === undefined ? 0 : halfWidth.waist(waist), bodyHalfAt(g, bandY) + 0.5);
  const hipHalf = Math.max(hips === undefined ? 0 : halfWidth.hips(hips), g.half.hip + 0.6);
  // The hip corner sits on the hip line, unless the band is already below it (a rise
  // the fit calls "won't stay up"): then just under the band, so the outline never doubles back.
  const hipY = Math.max(g.y.hip, bandY + 1);

  const crotchY = g.y.crotch + 2;
  const inseam = size.inseam ?? g.y.floor - crotchY;
  const rawHem = crotchY + inseam;
  const pooled = rawHem > g.y.floor - 0.5;
  const hemY = Math.min(rawHem, g.y.floor - 0.5);

  // Leg widths from the chart (halfWidth.leg, the body's own factor), never inside the leg.
  const legHalf = (chart: number | undefined, bodyHalf: number) =>
    Math.max(chart === undefined ? bodyHalf + FALLBACK_ROOM_CM : halfWidth.leg(chart), bodyHalf + MIN_ROOM_CM);
  const thighHalf = legHalf(thigh, g.leg.thighHalf);
  // The knee sits at the body's knee, or half way down a leg that ends above it.
  const kneeY = hemY > g.y.knee + 4 ? g.y.knee : lerp(g.leg.thighY, hemY, 0.5);
  const t = Math.min(1, Math.max(0, (hemY - g.y.knee) / (g.y.ankle - g.y.knee)));
  const hemX = hemY > g.y.knee ? lerp(g.leg.kneeX, g.leg.ankleX, t) : g.leg.kneeX;
  const kneeHalf = legHalf(knee, g.leg.kneeHalf);
  const ankleHalf = g.leg.ankleHalf + MIN_ROOM_CM;
  const hemHalf = opening === undefined ? Math.max(HEM_HALF[garment.type] + (pooled ? 1.2 : 0), ankleHalf) : Math.max(halfWidth.leg(opening), ankleHalf);

  const thighOuter = g.leg.thighX + thighHalf;
  const thighInner = Math.max(0.6, g.leg.thighX - thighHalf);
  const kneeOuter: XY = { x: g.leg.kneeX + kneeHalf, y: kneeY };
  const kneeInner: XY = { x: Math.max(0.6, g.leg.kneeX - kneeHalf), y: kneeY };
  const hemOuter: XY = { x: hemX + hemHalf, y: hemY };
  const hemInner: XY = { x: Math.max(0.6, hemX - hemHalf), y: hemY };

  const right: Pt[] = [
    { x: bandHalf, y: bandY, corner: true },
    { x: hipHalf, y: hipY },
    { x: thighOuter, y: g.leg.thighY },
    { ...kneeOuter },
    { ...hemOuter, corner: true },
    { ...hemInner, corner: true },
    { ...kneeInner },
    { x: thighInner, y: g.leg.thighY },
    { x: 0, y: crotchY, corner: true },
  ];
  const left = [...right].reverse().map((p) => ({ ...p, x: -p.x })).slice(1); // skip the shared crotch point

  const rightEdges: SleeveEdges = {
    outer: edge({ x: hipHalf, y: hipY }, kneeOuter, hemOuter),
    inner: edge({ x: 0, y: crotchY }, kneeInner, hemInner),
  };
  // Each leg's clip follows the pants outline itself (out through the thigh), so the
  // photo reaches the outline's edge; the strips' own edges run straight hip to knee.
  const legRight = right.slice(1);
  const legOutline = (pts: Pt[]) => smoothPath(pts, true);
  const leftEdges: SleeveEdges = { outer: rightEdges.outer.map(mirrorX), inner: rightEdges.inner.map(mirrorX) };
  const waistRight: Pt = { x: bandHalf, y: bandY };
  const hipRight: Pt = { x: hipHalf, y: hipY };
  const mirror = (p: XY): Pt => ({ x: -p.x, y: p.y });
  return {
    body: smoothPath([...right, ...left], true),
    legs: { right: legOutline(legRight), left: legOutline(legRight.map((p) => ({ ...p, x: -p.x }))) },
    landmarks: {
      waistLeft: mirror(waistRight),
      waistMid: { x: 0, y: bandY },
      waistRight,
      hipLeft: mirror(hipRight),
      hipRight,
      crotch: { x: 0, y: crotchY },
      kneeOuterLeft: mirror(kneeOuter),
      kneeInnerLeft: mirror(kneeInner),
      kneeOuterRight: kneeOuter,
      kneeInnerRight: kneeInner,
      hemOuterLeft: mirror(hemOuter),
      hemInnerLeft: mirror(hemInner),
      hemOuterRight: hemOuter,
      hemInnerRight: hemInner,
    },
    markers: {
      waist: { x: bandHalf, y: bandY },
      rise: { x: 0, y: bandY },
      hips: { x: hipHalf, y: hipY },
      thigh: { x: thighOuter, y: g.leg.thighY },
      inseam: { x: hemOuter.x, y: hemY },
      legOpening: { x: hemX, y: hemY },
    },
    limbEdges: { right: rightEdges, left: leftEdges },
    pooled,
    approximate,
  };
}
