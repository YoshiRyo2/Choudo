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
