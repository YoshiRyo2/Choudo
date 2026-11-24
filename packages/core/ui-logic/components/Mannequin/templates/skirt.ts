/**
 * The skirt template: a skirt drawn over the body from the body's own heights and
 * the size chart. Pure; no React.
 *
 * Skin rule: the band, the hip point and the hem sit at domain/fit/skirt.ts's
 * heights (the same functions the fit compares at), and every width is a chart
 * girth through halfWidth. An A-line or a pencil shape follows from the chart's
 * sweep against its hips. Without a sweep the skirt falls straight from the hips,
 * drawn dashed (`approximate`).
 */

import type { BodyMeasurements } from '../../../../domain/body';
import { skirtBandHeight, skirtHemHeight, skirtHipHeight } from '../../../../domain/fit';
import { girthKnown, type Garment, type SizeMeasurements } from '../../../../domain/garments';
import { bodyHalfAt, halfWidth, lerp, smoothPath, type BodyGeometry, type Marker, type Pt } from '../geometry';

export interface SkirtShape {
  body: string;
  markers: Record<'waist' | 'hips' | 'length' | 'walkingRoom', Marker>;
  /** Where the hem is drawn (y, cm from the top of the head), and half its width. */
  hemY: number;
  hemHalf: number;
  /** Some width is a fallback, not the chart's: drawn dashed. */
  approximate: boolean;
}

/** A skirt is never drawn closer to the body than this (cm, half width). Skin only. */
export const MIN_ROOM_CM = 0.5;

/** What a skirt outline is drawn from: heights (y, cm from the top of the head) and chart girths (full, cm). */
export interface SkirtOutlineInput {
  bandY: number;
  hipY: number;
  hemY: number;
  /** Missing: as narrow as the body allows (a band no width was given for). */
  waist?: number;
  /** The band's half width as drawn above it (a dress's bodice at the seam); wins over `waist`. */
  bandHalf?: number;
  /** Missing: the body at the hip point plus 2 cm. */
  hips?: number;
  /** Missing: straight down from the hips. */
  sweep?: number;
}

export interface SkirtOutline {
  /** Closed path, band to hem. */
  body: string;
  /** Right-side points, band to hem. */
  right: Pt[];
  bandY: number;
  hipY: number;
  hemY: number;
  bandHalf: number;
  hipHalf: number;
  hemHalf: number;
}

/**
 * A skirt's outline from the band down: the band, a hip point and a hem, each at
 * least the body's width there. The hip point is kept below the band and the hem
 * below the hips and above the floor. Shared by skirts and a dress's skirt.
 */
export function skirtOutline(g: BodyGeometry, input: SkirtOutlineInput): SkirtOutline {
  const { bandY, waist, hips, sweep } = input;
  // Never inside the body at that height.
  const atLeastBody = (half: number, y: number) => Math.max(half, bodyHalfAt(g, y) + MIN_ROOM_CM);

  // The hip point sits below the band, whatever the chart says (it can't be drawn above it).
  const hipY = Math.max(input.hipY, bandY + 1);
  const hemY = Math.max(Math.min(input.hemY, g.y.floor - 0.5), hipY + 1);

  const bandHalf = atLeastBody(input.bandHalf ?? (waist === undefined ? 0 : halfWidth.waist(waist)), bandY);
  const hipHalf = atLeastBody(hips === undefined ? bodyHalfAt(g, hipY) + 2 : halfWidth.hips(hips), hipY);
  // An A-line flares from the hips, a pencil narrows; without a sweep, straight down.
  const hemHalf = atLeastBody(sweep === undefined ? hipHalf : halfWidth.hips(sweep), hemY);

  const right: Pt[] = [
    { x: bandHalf, y: bandY, corner: true },
    { x: lerp(bandHalf, hipHalf, 0.75), y: lerp(bandY, hipY, 0.5) },
    { x: hipHalf, y: hipY },
    { x: hemHalf, y: hemY, corner: true },
  ];
  const left = [...right].reverse().map((p) => ({ ...p, x: -p.x }));
  return { body: smoothPath([...right, ...left], true), right, bandY, hipY, hemY, bandHalf, hipHalf, hemHalf };
}

export function skirtShape(g: BodyGeometry, body: BodyMeasurements, garment: Garment, size: SizeMeasurements): SkirtShape {
  const chartGirth = (key: 'waist' | 'hips' | 'hemSweep') =>
    size[key] !== undefined && girthKnown(garment, key) ? size[key] : undefined;
  const [waist, hips, sweep] = (['waist', 'hips', 'hemSweep'] as const).map(chartGirth);
  const approximate = waist === undefined || hips === undefined || sweep === undefined;

  const o = skirtOutline(g, {
    bandY: g.height - skirtBandHeight(body, garment),
    hipY: g.height - skirtHipHeight(body, garment),
    hemY: g.height - skirtHemHeight(body, garment, size),
    waist,
    hips,
    sweep,
  });

  return {
    body: o.body,
    markers: {
      waist: { x: o.bandHalf, y: o.bandY },
      hips: { x: o.hipHalf, y: o.hipY },
      length: { x: o.hemHalf, y: o.hemY },
      walkingRoom: { x: 0, y: o.hemY },
    },
    hemY: o.hemY,
    hemHalf: o.hemHalf,
    approximate,
  };
}
