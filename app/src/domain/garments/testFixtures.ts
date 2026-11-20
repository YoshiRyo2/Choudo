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

/**
 * A hoodie on the knit template: chest flat, length from the high point of the
 * shoulder, sleeve from the centre back, and a rib hem band that stretches.
 * Numbers are round, not a real chart.
 */
export const KNIT_HOODIE_SEED: SeedGarment = {
  id: 'test-knit-hoodie',
  brand: 'Test',
  name: 'Test hoodie',
  category: 'top',
  type: 'hoodie',
  sizing: 'unisex',
  color: '#556677',
  sleeve: 'long',
  stretch: { default: 'none', hemBand: 'high' },
  fitIntent: 'regular',
  chart: { unit: 'in', girth: 'flat', definitions: { length: 'hps', sleeve: 'center_back_to_cuff' } },
  source: { placeholder: false, tier: 'B', url: 'https://example.com/hoodie', capturedOn: '2026-11-20' },
  sizes: [
    { label: 'S', measurements: { chest: 20, length: 27, sleeve: 33, hemBand: 17 } },
    { label: 'M', measurements: { chest: 22, length: 28, sleeve: 34, hemBand: 18.75 } },
    { label: 'L', measurements: { chest: 24, length: 29, sleeve: 35, hemBand: 20.5 } },
    { label: 'XL', measurements: { chest: 26, length: 30, sleeve: 36, hemBand: 22 } },
  ],
};

export const KNIT_HOODIE: Garment = normalizeGarment(KNIT_HOODIE_SEED);
