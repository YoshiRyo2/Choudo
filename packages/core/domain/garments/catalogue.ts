/**
 * Which garments to show a body: ones cut for its body type, plus unisex. The
 * user can ask to see everything instead.
 */

import type { BodyType } from '../body';
import type { Garment, GarmentCategory } from './types';

/** "matching": the body's own sizing plus unisex. "all": the whole catalogue. */
export type CatalogueScope = 'matching' | 'all';
export const CATALOGUE_SCOPES: readonly CatalogueScope[] = ['matching', 'all'];

/** True for a garment cut for this body type, or for anyone. */
export const fitsBodyType = (garment: Pick<Garment, 'sizing'>, bodyType: BodyType): boolean =>
  garment.sizing === 'unisex' || garment.sizing === bodyType;

/** The garments to show, in catalogue order, optionally one category only. */
export function catalogueFor<G extends Pick<Garment, 'sizing' | 'category'>>(
  garments: readonly G[],
  bodyType: BodyType,
  scope: CatalogueScope,
  category?: GarmentCategory,
): G[] {
  return garments.filter(
    (g) => (category === undefined || g.category === category) && (scope === 'all' || fitsBodyType(g, bodyType)),
  );
}

/** Whether invented ("Sample data") garments may be shown: development and Test mode only. */
export interface PublicOptions {
  includeSamples: boolean;
}

/**
 * The garments the app may show at all: every garment from a real size chart, plus
 * the placeholder rows (`source.placeholder`) only when `includeSamples` is true.
 * The public site never shows invented numbers. Catalogue order is kept.
 */
export function publicGarments<G extends { source: Pick<Garment['source'], 'placeholder'> }>(
  garments: readonly G[],
  { includeSamples }: PublicOptions,
): G[] {
  return includeSamples ? [...garments] : garments.filter((g) => !g.source.placeholder);
}

/** The categories with at least one garment in the list: a category tab or filter with none is hidden. */
export function categoriesIn(garments: readonly Pick<Garment, 'category'>[]): Set<GarmentCategory> {
  return new Set(garments.map((g) => g.category));
}
