/**
 * The dress template: a bodice (topShape, ended at the waist seam) joined to a
 * skirt (skirtOutline, from the seam to the hem). Pure; no React.
 *
 * Skin rule: the seam and the hem sit at domain/fit/dress.ts's heights (the same
 * functions the fit compares at), the hips at the body's hip line where the fit
 * compares them, and every width is a chart girth through halfWidth (the bodice
 * is topShape over the chart's bust, as for any top). A chart without hips or a
 * hem sweep falls straight from the seam, drawn dashed (`approximate`).
 */

import type { BodyMeasurements } from '../../../../domain/body';
import { dressHemHeight, dressSeamHeight } from '../../../../domain/fit';
import { girthKnown, type Garment, type SizeMeasurements } from '../../../../domain/garments';
import { bodyHalfAt, halfWidth, type BodyGeometry, type Marker } from '../geometry';
import { topShape, type TopShape } from '../topShape';
import { MIN_ROOM_CM, skirtOutline } from './skirt';

export type DressMarker = 'chest' | 'shoulder' | 'sleeve' | 'waist' | 'hips' | 'length' | 'walkingRoom';

export interface DressShape {
  /** The top half, ending at the seam (its body, sleeves, arms, folds). */
  bodice: TopShape;
  /** The skirt, seam to hem (closed path), drawn over the bodice's lower edge. */
  skirt: string;
  /** Where to pin each zone's marker; waist and hips only when the chart gives them. */
  markers: Partial<Record<DressMarker, Marker>>;
  /** Where the hem is drawn (y, cm from the top of the head). */
  hemY: number;
  /** The bodice with its side seam carried on down the skirt: what a jacket over the dress hangs off. */
  asUnder: TopShape;
  /** Some width is a fallback, not the chart's: drawn dashed. */
  approximate: boolean;
}

export function dressShape(g: BodyGeometry, body: BodyMeasurements, garment: Garment, size: SizeMeasurements): DressShape {
  const chartGirth = (key: 'waist' | 'hips' | 'hemSweep') =>
    size[key] !== undefined && girthKnown(garment, key) ? size[key] : undefined;
  const [waist, hips, sweep] = (['waist', 'hips', 'hemSweep'] as const).map(chartGirth);

  const seamY = g.height - dressSeamHeight(body, garment);
  const seamHalf = waist === undefined ? undefined : Math.max(halfWidth.waist(waist), bodyHalfAt(g, seamY) + MIN_ROOM_CM);
  const bodice = topShape(g, garment, size, body.chestCm, body, { hemAt: { y: seamY, half: seamHalf } });
  const side = bodice.right.sideSeam;
  const bandHalf = side[side.length - 1]!.x;

  const skirt = skirtOutline(g, {
    bandY: seamY,
    hipY: g.y.hip,
    hemY: g.height - dressHemHeight(body, garment, size),
    bandHalf,
    hips,
    sweep,
  });

  const markers: DressShape['markers'] = {
    ...(bodice.markers.chest ? { chest: bodice.markers.chest } : {}),
    ...(bodice.markers.sleeve ? { sleeve: bodice.markers.sleeve } : {}),
    shoulder: { x: bodice.right.seam.x, y: bodice.right.seam.y },
    ...(waist !== undefined ? { waist: { x: skirt.bandHalf, y: skirt.bandY } } : {}),
    ...(hips !== undefined ? { hips: { x: skirt.hipHalf, y: skirt.hipY } } : {}),
    length: { x: skirt.hemHalf, y: skirt.hemY },
    walkingRoom: { x: 0, y: skirt.hemY },
  };

  return {
    bodice,
    skirt: skirt.body,
    markers,
    hemY: skirt.hemY,
    asUnder: { ...bodice, right: { ...bodice.right, sideSeam: [...side, ...skirt.right.slice(1)] } },
    approximate: bodice.approximate || hips === undefined || sweep === undefined,
  };
}
