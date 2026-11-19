import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { preferenceSpec, recommendSize } from '../../domain/fit';
import { findGarment, garmentsByCategory } from '../../domain/garments';
import { defaultSize, resolveOutfit, suggestedFit, wearGarment } from './outfit';
import { EMPTY_OUTFIT } from './stored';
import { UNKNOWN_CHEST_TEE } from '../../domain/garments/testFixtures';

const body = estimateBody({ heightCm: 176, weightKg: 85, sizing: 'mens' });
const pref = preferenceSpec(null, null);

describe('resolveOutfit', () => {
  it('fills an empty outfit with the first garments in their suggested sizes', () => {
    const o = resolveOutfit(EMPTY_OUTFIT, body, pref);
    const top = garmentsByCategory('top')[0]!;
    expect(o.topId).toBe(top.id);
    expect(o.topSize).toBe(recommendSize(body, top, pref));
    expect(o.bottomId).toBe(garmentsByCategory('bottom')[0]!.id);
  });

  it('keeps a valid saved choice', () => {
    const saved = { topId: 'fieldline-oxford', topSize: 'XL', bottomId: 'corvo-slim-jean', bottomSize: '30x30' };
    expect(resolveOutfit(saved, body, pref)).toEqual(saved);
  });

  it('repairs stale ids, sizes, and garments saved in the wrong slot', () => {
    const o = resolveOutfit({ topId: 'gone', topSize: 'M', bottomId: 'knightweave-tee', bottomSize: '99' }, body, pref);
    expect(findGarment(o.topId!)?.category).toBe('top');
    expect(findGarment(o.bottomId!)?.category).toBe('bottom');
    expect(findGarment(o.bottomId!)!.sizes.map((s) => s.label)).toContain(o.bottomSize);
  });
});

describe('wearGarment', () => {
  const current = { topId: 'knightweave-tee', topSize: 'M', bottomId: 'corvo-slim-jean', bottomSize: '32x32' };

  it('swaps only the slot the garment belongs to', () => {
    expect(wearGarment(current, findGarment('fieldline-oxford')!, 'L')).toEqual({ ...current, topId: 'fieldline-oxford', topSize: 'L' });
    expect(wearGarment(current, findGarment('fieldline-jogger')!, 'S')).toEqual({ ...current, bottomId: 'fieldline-jogger', bottomSize: 'S' });
  });
});

describe('defaultSize', () => {
  it('falls back to the middle size when no size can be recommended', () => {
    const tee = UNKNOWN_CHEST_TEE;
    expect(recommendSize(body, tee, pref)).toBeNull();
    expect(defaultSize(body, tee, pref)).toBe('L'); // S M [L] XL XXL
  });
});

describe('suggestedFit', () => {
  it('uses the recommended size when there is one', () => {
    const tee = findGarment('gildan-5000')!;
    const { fit, recommended } = suggestedFit(body, tee, pref);
    expect(recommended).toBe(true);
    expect(fit.sizeLabel).toBe(recommendSize(body, tee, pref));
  });

  it('falls back to the middle size and says so', () => {
    const { fit, recommended } = suggestedFit(body, UNKNOWN_CHEST_TEE, pref);
    expect(recommended).toBe(false);
    expect(fit.sizeLabel).toBe('L');
  });
});
