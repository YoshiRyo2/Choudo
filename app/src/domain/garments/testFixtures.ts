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

/**
 * A jacket on the jacket template (outer slot): chest flat, length from the high
 * point of the shoulder, sleeve from the centre back. In cm, with lengths chosen
 * to land on each length mark on a men's 176 cm body (torso 72.16 cm).
 */
export const JACKET_SEED: SeedGarment = {
  id: 'test-jacket',
  brand: 'Test',
  name: 'Test jacket',
  category: 'outer',
  type: 'jacket',
  sizing: 'mens',
  color: '#334455',
  sleeve: 'long',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'cm', girth: 'flat', definitions: { length: 'hps', sleeve: 'center_back_to_cuff' } },
  source: { placeholder: false, tier: 'B', url: 'https://example.com/jacket', capturedOn: '2026-11-20' },
  sizes: [
    { label: 'S', measurements: { chest: 55, length: 60, sleeve: 85 } },
    { label: 'M', measurements: { chest: 61, length: 72.66, sleeve: 88 } },
    { label: 'L', measurements: { chest: 63, length: 84.2, sleeve: 90 } },
    { label: 'XL', measurements: { chest: 65, length: 104.2, sleeve: 92 } },
    { label: 'XXL', measurements: { chest: 67, length: 117.2, sleeve: 94 } },
  ],
};

export const JACKET: Garment = normalizeGarment(JACKET_SEED);

/**
 * A women's dress on the dress template (onepiece slot): bust, waist at a natural
 * seam, hips, length from the high point of the shoulder, hem sweep, short
 * sleeves. In cm, round numbers, not a real chart.
 */
export const DRESS_SEED: SeedGarment = {
  id: 'test-dress',
  brand: 'Test',
  name: 'Test dress',
  category: 'onepiece',
  type: 'dress',
  sizing: 'womens',
  color: '#2f4a6b',
  sleeve: 'short',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'cm', girth: 'circumference', definitions: { length: 'hps', sleeve: 'top_of_sleeve', waistSeam: 'natural' } },
  source: { placeholder: false, tier: 'B', url: 'https://example.com/dress', capturedOn: '2026-11-20' },
  sizes: [
    { label: 'S', measurements: { chest: 88, waist: 72, hips: 96, length: 97, sleeve: 12, hemSweep: 150 } },
    { label: 'M', measurements: { chest: 94, waist: 78, hips: 102, length: 99, sleeve: 12.5, hemSweep: 156 } },
    { label: 'L', measurements: { chest: 100, waist: 84, hips: 108, length: 101, sleeve: 13, hemSweep: 162 } },
    { label: 'XL', measurements: { chest: 108, waist: 92, hips: 116, length: 103, sleeve: 13.5, hemSweep: 170 } },
  ],
};

export const DRESS: Garment = normalizeGarment(DRESS_SEED);
