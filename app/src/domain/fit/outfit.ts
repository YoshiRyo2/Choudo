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
  /** Fitted over the top, when there is one. */
  outer?: GarmentFit;
  notes: LayerNote[];
}

/** Every worn garment's fit: the top and bottom on the bare body, the outer layer over the top. */
export function fitOutfit(body: BodyModel, worn: { top?: UnderLayer; bottom?: UnderLayer; outer?: UnderLayer }): OutfitFit {
  const fit = (l: UnderLayer, under?: UnderLayer) => fitGarment(body, l.garment, l.sizeLabel, under);
  return {
    ...(worn.top ? { top: fit(worn.top) } : {}),
    ...(worn.bottom ? { bottom: fit(worn.bottom) } : {}),
    ...(worn.outer ? { outer: fit(worn.outer, worn.top) } : {}),
    notes: worn.top && worn.outer ? layerNotes(body.measurements, worn.top, worn.outer) : [],
  };
}
