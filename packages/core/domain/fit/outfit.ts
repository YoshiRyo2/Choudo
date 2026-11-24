/**
 * A whole outfit's fit: the top and bottom on the bare body, the outer layer over
 * the top (layers.ts), and notes on how the layers sit together. Pure.
 */

import type { BodyMeasurements, BodyModel } from '../body';
import { girthKnown } from '../garments';
import { fitGarment, type GarmentFit } from './fitEngine';
import { layerAllowanceCm, type UnderLayer } from './layers';
import { hpsLengthCm, sleeveReachCm } from './tops';

/** A check on how two layers sit together. Never changes a label. cm = by how much. */
export interface LayerNote {
  kind: 'hem-shows' | 'cuffs-show' | 'bunches';
  cm: number;
}

/** Edges this close (cm) or closer don't get a note. */
const NOTE_MIN_CM = 1;

function layerNotes(body: BodyMeasurements, top: UnderLayer, outer: UnderLayer): LayerNote[] {
  const sizeOf = (l: UnderLayer) => l.garment.sizes.find((s) => s.label === l.sizeLabel)!.measurements;
  const ts = sizeOf(top);
  const os = sizeOf(outer);
  const notes: LayerNote[] = [];
  const topLength = hpsLengthCm(top.garment, ts);
  const outerLength = hpsLengthCm(outer.garment, os);
  if (topLength !== undefined && outerLength !== undefined && topLength - outerLength > NOTE_MIN_CM) {
    notes.push({ kind: 'hem-shows', cm: topLength - outerLength });
  }
  const topReach = sleeveReachCm(top.garment, ts, body);
  const outerReach = sleeveReachCm(outer.garment, os, body);
  if (topReach !== undefined && outerReach !== undefined && topReach - outerReach > NOTE_MIN_CM) {
    notes.push({ kind: 'cuffs-show', cm: topReach - outerReach });
  }
  if (ts.chest !== undefined && os.chest !== undefined && girthKnown(top.garment, 'chest') && girthKnown(outer.garment, 'chest')) {
    const topEase = ts.chest - body.chestCm;
    const outerEase = os.chest - (body.chestCm + layerAllowanceCm(body, top).chestCm);
    if (topEase > outerEase) notes.push({ kind: 'bunches', cm: topEase - outerEase });
  }
  return notes;
}

export interface OutfitFit {
  top?: GarmentFit;
  bottom?: GarmentFit;
  /** A dress, in place of the top and the bottom. */
  onepiece?: GarmentFit;
  /** Fitted over the top (or the dress), when there is one. */
  outer?: GarmentFit;
  notes: LayerNote[];
}

/**
 * Every worn garment's fit: the top, bottom and dress on the bare body, the outer
 * layer over the top or the dress. A dress always reaches below a jacket, so its
 * hem gets no note.
 */
export function fitOutfit(
  body: BodyModel,
  worn: { top?: UnderLayer; bottom?: UnderLayer; onepiece?: UnderLayer; outer?: UnderLayer },
): OutfitFit {
  const fit = (l: UnderLayer, under?: UnderLayer) => fitGarment(body, l.garment, l.sizeLabel, under);
  const under = worn.top ?? worn.onepiece;
  const notes = under && worn.outer ? layerNotes(body.measurements, under, worn.outer) : [];
  return {
    ...(worn.top ? { top: fit(worn.top) } : {}),
    ...(worn.bottom ? { bottom: fit(worn.bottom) } : {}),
    ...(worn.onepiece ? { onepiece: fit(worn.onepiece) } : {}),
    ...(worn.outer ? { outer: fit(worn.outer, under) } : {}),
    notes: worn.top ? notes : notes.filter((n) => n.kind !== 'hem-shows'),
  };
}
