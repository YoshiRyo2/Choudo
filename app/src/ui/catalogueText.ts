/**
 * Wording for the catalogue filter ("Women's & unisex" / "All").
 */

import type { BodyType } from '../domain/body';
import type { CatalogueScope, GarmentCategory } from '../domain/garments';

const BODY_WORD: Record<BodyType, string> = { womens: 'Women’s', mens: 'Men’s' };

/** The two choices of the "Show" control. */
export function catalogueOptions(bodyType: BodyType): { value: CatalogueScope; label: string }[] {
  return [
    { value: 'matching', label: `${BODY_WORD[bodyType]} & unisex` },
    { value: 'all', label: 'All' },
  ];
}

const CATEGORY_WORD: Record<GarmentCategory, string> = { top: 'tops', bottom: 'bottoms' };

/** "No women’s or unisex bottoms yet." */
export function emptyCategoryText(bodyType: BodyType, category: GarmentCategory): string {
  return `No ${BODY_WORD[bodyType].toLowerCase()} or unisex ${CATEGORY_WORD[category]} yet.`;
}

/** The end of the Discover feed when it only shows the body's own sizing. */
export function endOfMatchingFeedText(bodyType: BodyType): string {
  return `You’ve seen every ${BODY_WORD[bodyType].toLowerCase()} and unisex garment we have.`;
}
