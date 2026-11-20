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
const MIN_ROOM_CM = 0.5;

export function skirtShape(g: BodyGeometry, body: BodyMeasurements, garment: Garment, size: SizeMeasurements): SkirtShape {
  const chartGirth = (key: 'waist' | 'hips' | 'hemSweep') =>
    size[key] !== undefined && girthKnown(garment, key) ? size[key] : undefined;
  const [waist, hips, sweep] = (['waist', 'hips', 'hemSweep'] as const).map(chartGirth);
  const approximate = waist === undefined || hips === undefined || sweep === undefined;

  // Never inside the body at that height.
  const atLeastBody = (half: number, y: number) => Math.max(half, bodyHalfAt(g, y) + MIN_ROOM_CM);

  const bandY = g.height - skirtBandHeight(body, garment);
  // The hip point sits below the band, whatever the chart says (it can't be drawn above it).
  const hipY = Math.max(g.height - skirtHipHeight(body, garment), bandY + 1);
  const hemY = Math.max(Math.min(g.height - skirtHemHeight(body, garment, size), g.y.floor - 0.5), hipY + 1);

  const bandHalf = atLeastBody(waist === undefined ? 0 : halfWidth.waist(waist), bandY);
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

  return {
    body: smoothPath([...right, ...left], true),
    markers: {
      waist: { x: bandHalf, y: bandY },
      hips: { x: hipHalf, y: hipY },
      length: { x: hemHalf, y: hemY },
      walkingRoom: { x: 0, y: hemY },
    },
    hemY,
    hemHalf,
    approximate,
  };
}
