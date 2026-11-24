import { describe, expect, it } from 'vitest';
import { buildFeed, likedIds, recordSwipe, unlike } from './feed';
import type { Swipe } from './stored';

const garments = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const swipe = (garmentId: string, liked: boolean, at: string): Swipe => ({ garmentId, sizeShown: 'M', liked, at });

describe('recordSwipe', () => {
  it('keeps one swipe per garment, the newest', () => {
    const once = recordSwipe([], swipe('a', false, '2026-01-01'));
    const twice = recordSwipe(once, swipe('a', true, '2026-01-02'));
    expect(twice).toEqual([swipe('a', true, '2026-01-02')]);
  });
});

describe('unlike', () => {
  it('turns a like into a pass, keeping the size shown', () => {
    const liked = [{ ...swipe('a', true, '2026-01-01'), sizeShown: 'L' }];
    expect(unlike(liked, 'a', '2026-01-05')).toEqual([{ garmentId: 'a', sizeShown: 'L', liked: false, at: '2026-01-05' }]);
  });

  it('leaves passes and unknown garments alone', () => {
    const passed = [swipe('a', false, '2026-01-01')];
    expect(unlike(passed, 'a', '2026-01-05')).toBe(passed);
    expect(unlike(passed, 'zzz', '2026-01-05')).toBe(passed);
  });
});

describe('likedIds', () => {
  it('lists liked garments, newest first', () => {
    const swipes = [swipe('a', true, '2026-01-01'), swipe('b', false, '2026-01-02'), swipe('c', true, '2026-01-03')];
    expect(likedIds(swipes)).toEqual(['c', 'a']);
  });
});

describe('buildFeed', () => {
  it('shows everything in catalogue order before any swipes', () => {
    expect(buildFeed(garments, []).map((g) => g.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts unseen first, then passed oldest-first, and leaves liked out', () => {
    const swipes = [swipe('a', false, '2026-01-03'), swipe('b', true, '2026-01-01'), swipe('c', false, '2026-01-02')];
    expect(buildFeed(garments, swipes).map((g) => g.id)).toEqual(['d', 'c', 'a']);
  });

  it('is empty once everything is liked', () => {
    const swipes = garments.map((g) => swipe(g.id, true, '2026-01-01'));
    expect(buildFeed(garments, swipes)).toEqual([]);
  });

  it('ignores swipes on garments no longer in the catalogue', () => {
    expect(buildFeed(garments, [swipe('gone', false, '2026-01-01')]).map((g) => g.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
