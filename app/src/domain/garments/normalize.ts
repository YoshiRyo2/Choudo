/**
 * Turning seed rows (numbers as printed) into app-ready garments (cm, full
 * circumferences), keeping a record of where each number came from and every
 * conversion applied to it.
 */

import { inToCm } from '../units';
import type {
  GarmentSize,
  MeasuredValue,
  MeasurementKey,
  MeasurementProvenance,
  SeedGarment,
  SeedSize,
  SizeMeasurements,
} from './types';

export const GIRTH_KEYS = ['chest', 'waist', 'hips'] as const;
export const LENGTH_KEYS = ['length', 'sleeve', 'shoulder', 'inseam', 'rise'] as const;
/**
 * Every garment measurement key, in a fixed order. The sampler draws a garment
 * offset per key in this order, so add new keys at the end.
 */
export const MEASUREMENT_KEYS: readonly MeasurementKey[] = [...GIRTH_KEYS, ...LENGTH_KEYS];

export const isGirthKey = (key: MeasurementKey): key is (typeof GIRTH_KEYS)[number] =>
  (GIRTH_KEYS as readonly string[]).includes(key);

type Chart = SeedGarment['chart'];

/** A seed value as `{ value, origin }`: a plain number was copied from the chart. */
export function readValue(raw: number | MeasuredValue): MeasuredValue {
  return typeof raw === 'number' ? { value: raw, origin: 'chart' } : raw;
}

/** One printed number to cm (full circumference for girths), and the steps taken. */
export function convertValue(
  key: MeasurementKey,
  printed: number,
  chart: Pick<Chart, 'unit' | 'girth'>,
): { cm: number; conversions: string[] } {
  const conversions: string[] = [];
  let v = printed;
  if (isGirthKey(key)) {
    // Flat measurements are half the circumference (same rule as src/fit.py).
    // For "unknown" we keep the printed value but the garment is marked unverified.
    if (chart.girth === 'flat') {
      v *= 2;
      conversions.push('flat width doubled to a full circumference');
    } else if (chart.girth === 'unknown') {
      conversions.push('chart doesn’t say flat or full circumference: used as printed, not scored');
    }
  }
  if (chart.unit === 'in') {
    v = inToCm(v);
    conversions.push('inches to cm');
  }
  return { cm: v, conversions };
}

/** Convert plain numbers (an audit, or a test fixture) to cm and full circumferences. */
export function normalizeMeasurements(
  raw: SizeMeasurements,
  chart: Pick<Chart, 'unit' | 'girth'>,
): SizeMeasurements {
  const out: SizeMeasurements = {};
  for (const key of MEASUREMENT_KEYS) {
    const v = raw[key];
    if (v !== undefined) out[key] = convertValue(key, v, chart).cm;
  }
  return out;
}

/** One seed size to cm, with provenance for every number. */
export function normalizeSize(size: SeedSize, chart: Chart): GarmentSize {
  const measurements: SizeMeasurements = {};
  const provenance: GarmentSize['provenance'] = {};
  for (const key of MEASUREMENT_KEYS) {
    const raw = size.measurements[key];
    if (raw === undefined) continue;
    const { value, origin, how } = readValue(raw);
    const { cm, conversions } = convertValue(key, value, chart);
    measurements[key] = cm;
    const p: MeasurementProvenance = { origin, printed: value, unit: chart.unit, conversions };
    if (how !== undefined) p.how = how;
    provenance[key] = p;
  }
  return { label: size.label, measurements, provenance };
}
