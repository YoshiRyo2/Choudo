/**
 * The leggings template: a skin-tight leg drawn on the body, on the pants
 * template's outline and warp points. Pure; no React.
 *
 * Skin rule: the band sits at bandHeight() and the hem at leggingsHemHeight(),
 * the same numbers the fit compares and lands. Widths are the body's own leg plus
 * LEGGINGS_ROOM_CM, since leggings are cut under the body and stretch onto it;
 * only where the chart is bigger than the body (a baggy legging) do they follow
 * the chart. No folds. Dashed only when the chart has no inseam to end the hem.
 */

import type { BodyMeasurements } from '@choudo/core/domain/body';
import { bandHeight, leggingsHemHeight, riseForBand } from '@choudo/core/domain/fit';
import { girthKnown, type Garment, type SizeMeasurements } from '@choudo/core/domain/garments';
import { bodyHalfAt, halfWidth, lerp, smoothPath, type BodyGeometry, type Pt } from '../geometry';
import type { SleeveEdges, XY } from '../photoWarp';
import { edge, type BottomShape } from './pants';

/** How far outside the skin leggings are drawn (cm, half width): just enough to read as a layer. */
export const LEGGINGS_ROOM_CM = 0.2;

/** The body's right leg at a height: its centre line and half width, between the drawn thigh, knee, calf and ankle. */
export function bodyLegAt(g: BodyGeometry, y: number): { x: number; half: number } {
  const calfX = lerp(g.leg.kneeX, g.leg.ankleX, 0.3);
  const stops = [
    { y: g.leg.thighY, x: g.leg.thighX, half: g.leg.thighHalf },
    { y: g.y.knee, x: g.leg.kneeX, half: g.leg.kneeHalf },
    { y: g.leg.calfY, x: calfX, half: g.leg.calfHalf },
    { y: g.y.ankle, x: g.leg.ankleX, half: g.leg.ankleHalf },
  ];
  if (y <= stops[0]!.y) return stops[0]!;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    if (y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return { x: lerp(a.x, b.x, t), half: lerp(a.half, b.half, t) };
    }
  }
  return stops[stops.length - 1]!;
}

export function leggingsShape(g: BodyGeometry, body: BodyMeasurements, garment: Garment, size: SizeMeasurements): BottomShape {
  const chart = (key: 'waist' | 'hips' | 'thigh' | 'calf') => (size[key] !== undefined && girthKnown(garment, key) ? size[key] : undefined);
  const ROOM = LEGGINGS_ROOM_CM;
  // Skin-tight, unless the chart is bigger than the body there.
  const atLeast = (bodyHalf: number, chartHalf: number | undefined) => Math.max(bodyHalf + ROOM, chartHalf ?? 0);
  const waist = chart('waist');
  const hips = chart('hips');
  const thigh = chart('thigh');
  const calf = chart('calf');

  const bandY = g.height - bandHeight(body, riseForBand(garment, size));
  const bandHalf = atLeast(bodyHalfAt(g, bandY), waist === undefined ? undefined : halfWidth.waist(waist));
  const hipY = Math.max(g.y.hip, bandY + 1);
  const hipHalf = atLeast(g.half.hip, hips === undefined ? undefined : halfWidth.hips(hips));
  const crotchY = g.y.crotch + 1.5;

  // The hem where the fit lands it; past the ankle bone it bunches at the ankle.
  const hemHeight = leggingsHemHeight(body, size);
  const rawHem = hemHeight === null ? g.y.ankle : g.height - hemHeight;
  const pooled = rawHem > g.y.ankle + 0.5;
  const hemY = Math.max(Math.min(rawHem, g.y.ankle), g.leg.thighY + 2);

  const thighHalf = atLeast(g.leg.thighHalf, thigh === undefined ? undefined : halfWidth.leg(thigh));
  const calfX = lerp(g.leg.kneeX, g.leg.ankleX, 0.3);
  const calfHalf = atLeast(g.leg.calfHalf, calf === undefined ? undefined : halfWidth.leg(calf));
  const hemLeg = bodyLegAt(g, hemY);
  const hemHalf = hemLeg.half + ROOM;
  const reachesKnee = hemY > g.y.knee + 1;
  const reachesCalf = hemY > g.leg.calfY + 1;

  const outer = (x: number, half: number, y: number): XY => ({ x: x + half, y });
  const inner = (x: number, half: number, y: number): XY => ({ x: Math.max(0.6, x - half), y });
  // The knee point sits at the body's knee, or half way down a leg that ends above it (the warp needs one).
  const kneeY = reachesKnee ? g.y.knee : lerp(g.leg.thighY, hemY, 0.5);
  const kneeLeg = bodyLegAt(g, kneeY);
  const kneeOuter = outer(kneeLeg.x, kneeLeg.half + ROOM, kneeY);
  const kneeInner = inner(kneeLeg.x, kneeLeg.half + ROOM, kneeY);
  const calfOuter = outer(calfX, calfHalf, g.leg.calfY);
  const calfInner = inner(calfX, calfHalf, g.leg.calfY);
  const hemOuter = outer(hemLeg.x, hemHalf, hemY);
  const hemInner = inner(hemLeg.x, hemHalf, hemY);
  const thighOuter = outer(g.leg.thighX, thighHalf, g.leg.thighY);
  const thighInner = inner(g.leg.thighX, thighHalf, g.leg.thighY);

  const right: Pt[] = [
    { x: bandHalf, y: bandY, corner: true },
    { x: hipHalf, y: hipY },
    { ...thighOuter },
    { ...kneeOuter },
    ...(reachesCalf ? [{ ...calfOuter }] : []),
    { ...hemOuter, corner: true },
    { ...hemInner, corner: true },
    ...(reachesCalf ? [{ ...calfInner }] : []),
    { ...kneeInner },
    { ...thighInner },
    { x: 0, y: crotchY, corner: true },
  ];
  const mirror = (p: XY): Pt => ({ x: -p.x, y: p.y });
  const left = [...right].reverse().map((p) => ({ ...p, x: -p.x })).slice(1);
  const rightEdges: SleeveEdges = {
    outer: edge({ x: hipHalf, y: hipY }, kneeOuter, hemOuter),
    inner: edge({ x: 0, y: crotchY }, kneeInner, hemInner),
  };
  const legRight = right.slice(1);
  const waistRight: Pt = { x: bandHalf, y: bandY };
  const hipRight: Pt = { x: hipHalf, y: hipY };
  return {
    body: smoothPath([...right, ...left], true),
    legs: { right: smoothPath(legRight, true), left: smoothPath(legRight.map(mirror), true) },
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
      hips: { x: hipHalf, y: hipY },
      thigh: { x: thighOuter.x, y: thighOuter.y },
      ...(reachesCalf ? { calf: { x: calfOuter.x, y: calfOuter.y } } : {}),
      inseam: { x: hemOuter.x, y: hemY },
    },
    limbEdges: { right: rightEdges, left: { outer: rightEdges.outer.map(mirror), inner: rightEdges.inner.map(mirror) } },
    pooled,
    approximate: hemHeight === null,
  };
}
