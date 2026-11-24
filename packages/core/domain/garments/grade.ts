/**
 * One confidence grade per garment, from its source and its check results.
 * Pure; see ConfidenceGrade in types.ts for what each grade means.
 */

import { readValue } from './normalize';
import type { ConfidenceGrade, SeedGarment, SourceTier } from './types';
import type { GarmentCheck } from './verify';

const AUDITABLE_TIERS: readonly SourceTier[] = ['A', 'B', 'C'];
const WEAK_TIERS: readonly SourceTier[] = ['E', 'F', 'G'];

/** True when any seed number was estimated rather than copied or measured. */
export function hasEstimatedValues(g: SeedGarment): boolean {
  return g.sizes.some((s) => Object.values(s.measurements).some((v) => v !== undefined && readValue(v).origin === 'estimated'));
}

/**
 * The garment's grade, or null when it has errors (it isn't in the catalogue).
 * Checked in order: a missing definition beats everything, then anything estimated.
 */
export function gradeGarment(g: SeedGarment, check: GarmentCheck): ConfidenceGrade | null {
  if (check.errors.length > 0) return null;
  if (check.unscorable.some((z) => z.required)) return 'unscored';
  const tier = g.source.tier;
  if (g.source.placeholder || tier === undefined || WEAK_TIERS.includes(tier) || hasEstimatedValues(g)) return 'estimated';
  // Warnings need a person to look, so they hold a garment back from "verified".
  if (AUDITABLE_TIERS.includes(tier) && g.audit !== undefined && check.warnings.length === 0) return 'verified';
  return 'charted';
}
