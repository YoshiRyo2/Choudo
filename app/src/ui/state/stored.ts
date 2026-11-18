/**
 * Everything Nimbus keeps on the device, with the guards used when reading it
 * back. Bump a key's version when its shape changes.
 */

import { validateBodyInput, type BodyInput } from '../../domain/body';

export const STORAGE_KEYS = {
  body: 'nimbus.body.v1',
  units: 'nimbus.units.v1',
  outfit: 'nimbus.outfit.v1',
} as const;

/** Display units. Metric = cm + kg, imperial = in + lb. Storage is always metric. */
export type UnitSystem = 'metric' | 'imperial';

export interface Outfit {
  topId: string | null;
  topSize: string | null;
  bottomId: string | null;
  bottomSize: string | null;
}

export const EMPTY_OUTFIT: Outfit = { topId: null, topSize: null, bottomId: null, bottomSize: null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStringOrNull = (v: unknown) => v === null || typeof v === 'string';

export function isStoredBody(v: unknown): v is BodyInput | null {
  if (v === null) return true;
  if (!isRecord(v)) return false;
  if (typeof v.heightCm !== 'number' || typeof v.weightKg !== 'number') return false;
  if (v.sizing !== 'mens' && v.sizing !== 'womens') return false;
  if (v.overrides !== undefined && !isRecord(v.overrides)) return false;
  return validateBodyInput(v as unknown as BodyInput).length === 0;
}

export const isUnitSystem = (v: unknown): v is UnitSystem => v === 'metric' || v === 'imperial';

export function isOutfit(v: unknown): v is Outfit {
  return (
    isRecord(v) &&
    isStringOrNull(v.topId) &&
    isStringOrNull(v.topSize) &&
    isStringOrNull(v.bottomId) &&
    isStringOrNull(v.bottomSize)
  );
}
