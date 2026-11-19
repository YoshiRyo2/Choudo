/**
 * Garments that exist only for tests. Never imported by app code, never in the catalogue.
 */

import { normalizeGarment } from './garments';
import type { Garment, SeedGarment } from './types';

/**
 * A real-looking tee whose chart doesn't say whether the chest is flat or a full
 * circumference, so its chest can't be scored (grade "unscored"). Length is
 * measured from the high point of the shoulder, so length still scores.
 * Five sizes, S to XXL: the middle one is L.
 */
export const UNKNOWN_CHEST_SEED: SeedGarment = {
  id: 'test-unknown-chest-tee',
  brand: 'Test',
  name: 'Tee with an unknown chest method',
  category: 'top',
  type: 'tee',
  sizing: 'mens',
  color: '#777777',
  sleeve: 'short',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'in', girth: 'unknown', lengthDefinition: 'hps', sleeveDefinition: 'top_of_sleeve' },
  source: { placeholder: false, tier: 'B', url: 'https://example.com/chart', capturedOn: '2026-11-18' },
  sizes: [
    { label: 'S', measurements: { chest: 40, length: 28 } },
    { label: 'M', measurements: { chest: 44, length: 28.5 } },
    { label: 'L', measurements: { chest: 48, length: 29.5 } },
    { label: 'XL', measurements: { chest: 52, length: 30.5 } },
    { label: 'XXL', measurements: { chest: 56, length: 31.5 } },
  ],
};

export const UNKNOWN_CHEST_TEE: Garment = normalizeGarment(UNKNOWN_CHEST_SEED);
