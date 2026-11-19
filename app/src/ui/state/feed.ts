/**
 * Discover's likes and passes, and the order of the card feed. Pure: takes the
 * stored swipes and returns new arrays.
 *
 * We keep one swipe per garment — swiping it again replaces the old one — so the
 * stored list stays as long as the catalogue at most.
 */

import type { Swipe } from './stored';

/** Add a swipe, replacing any earlier swipe on the same garment. */
export function recordSwipe(swipes: Swipe[], swipe: Swipe): Swipe[] {
  return [...swipes.filter((s) => s.garmentId !== swipe.garmentId), swipe];
}

/** Turn a like into a pass. Does nothing if the garment isn't liked. */
export function unlike(swipes: Swipe[], garmentId: string, at: string): Swipe[] {
  const current = swipes.find((s) => s.garmentId === garmentId);
  if (!current?.liked) return swipes;
  return recordSwipe(swipes, { ...current, liked: false, at });
}

/** Ids of liked garments, most recently liked first. */
export function likedIds(swipes: Swipe[]): string[] {
  return swipes
    .filter((s) => s.liked)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((s) => s.garmentId);
}

/**
 * The cards to show: garments never swiped first (catalogue order), then passed
 * ones (oldest pass first). Liked garments live in the Closet, not the feed.
 */
export function buildFeed<G extends { id: string }>(garments: readonly G[], swipes: Swipe[]): G[] {
  const byId = new Map(swipes.map((s) => [s.garmentId, s]));
  const unseen = garments.filter((g) => !byId.has(g.id));
  const passed = garments
    .filter((g) => byId.get(g.id)?.liked === false)
    .sort((a, b) => byId.get(a.id)!.at.localeCompare(byId.get(b.id)!.at));
  return [...unseen, ...passed];
}
