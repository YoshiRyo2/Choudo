import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { recommendSize } from '../../domain/fit';
import { findGarment, garmentsByCategory } from '../../domain/garments';
import { defaultSize, resolveOutfit } from './outfit';
import { EMPTY_OUTFIT } from './stored';

const body = estimateBody({ heightCm: 176, weightKg: 85, sizing: 'mens' });

describe('resolveOutfit', () => {
  it('fills an empty outfit with the first garments in their suggested sizes', () => {
    const o = resolveOutfit(EMPTY_OUTFIT, body);
    const top = garmentsByCategory('top')[0]!;
    expect(o.topId).toBe(top.id);
    expect(o.topSize).toBe(recommendSize(body, top));
    expect(o.bottomId).toBe(garmentsByCategory('bottom')[0]!.id);
  });

  it('keeps a valid saved choice', () => {
    const saved = { topId: 'fieldline-oxford', topSize: 'XL', bottomId: 'corvo-slim-jean', bottomSize: '30x30' };
    expect(resolveOutfit(saved, body)).toEqual(saved);
  });

  it('repairs stale ids, sizes, and garments saved in the wrong slot', () => {
    const o = resolveOutfit({ topId: 'gone', topSize: 'M', bottomId: 'knightweave-tee', bottomSize: '99' }, body);
    expect(findGarment(o.topId!)?.category).toBe('top');
    expect(findGarment(o.bottomId!)?.category).toBe('bottom');
    expect(findGarment(o.bottomId!)!.sizes.map((s) => s.label)).toContain(o.bottomSize);
  });
});

describe('defaultSize', () => {
  it('falls back to the middle size when nothing can be scored', () => {
    const le = findGarment('landsend-super-t')!;
    expect(defaultSize(body, le)).toBe('L'); // S M [L] XL XXL
  });
});
