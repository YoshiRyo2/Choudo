import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { preferenceSpec, recommendSize } from '../../domain/fit';
import { canWarp, findGarment, garmentsByCategory } from '../../domain/garments';
import { defaultSize, firstGarment, resolveOutfit, suggestedFit, wearGarment } from './outfit';
import { EMPTY_OUTFIT } from './stored';
import { UNKNOWN_CHEST_TEE } from '../../domain/garments/testFixtures';

const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
const pref = preferenceSpec(null, null);

describe('resolveOutfit', () => {
  it('fills an empty outfit with the first garments (photo ones first) in their suggested sizes', () => {
    const o = resolveOutfit(EMPTY_OUTFIT, body, pref);
    const top = garmentsByCategory('top').find((g) => canWarp(g.image))!;
    expect(o.topId).toBe(top.id);
    expect(o.topSize).toBe(recommendSize(body, top, pref));
    expect(o.bottomId).toBe(garmentsByCategory('bottom')[0]!.id);
  });

  it('keeps a valid saved choice', () => {
    const saved = { topId: 'fieldline-oxford', topSize: 'XL', bottomId: 'corvo-slim-jean', bottomSize: '30x30', outerId: null, outerSize: null, onepieceId: null, onepieceSize: null };
    expect(resolveOutfit(saved, body, pref)).toEqual(saved);
  });

  it('repairs stale ids, sizes, and garments saved in the wrong slot', () => {
    const o = resolveOutfit({ topId: 'gone', topSize: 'M', bottomId: 'knightweave-tee', bottomSize: '99', outerId: null, outerSize: null, onepieceId: null, onepieceSize: null }, body, pref);
    expect(findGarment(o.topId!)?.category).toBe('top');
    expect(findGarment(o.bottomId!)?.category).toBe('bottom');
    expect(findGarment(o.bottomId!)!.sizes.map((s) => s.label)).toContain(o.bottomSize);
  });
});

describe('wearGarment', () => {
  const current = { topId: 'knightweave-tee', topSize: 'M', bottomId: 'corvo-slim-jean', bottomSize: '32x32', outerId: null, outerSize: null, onepieceId: null, onepieceSize: null };

  it('swaps only the slot the garment belongs to', () => {
    expect(wearGarment(current, findGarment('fieldline-oxford')!, 'L')).toEqual({ ...current, topId: 'fieldline-oxford', topSize: 'L' });
    expect(wearGarment(current, findGarment('fieldline-jogger')!, 'S')).toEqual({ ...current, bottomId: 'fieldline-jogger', bottomSize: 'S', outerId: null, outerSize: null, onepieceId: null, onepieceSize: null });
  });
});

describe('resolveOutfit with a filtered catalogue', () => {
  it('fills from what is on show, leaves an empty category empty, and keeps a worn garment', () => {
    const unisexTops = garmentsByCategory('top').filter((g) => g.sizing === 'unisex');
    const o = resolveOutfit(EMPTY_OUTFIT, body, pref, unisexTops);
    expect(o.topId).toBe(unisexTops[0]!.id);
    expect(o.bottomId).toBeNull();
    const worn = resolveOutfit({ ...EMPTY_OUTFIT, bottomId: 'corvo-slim-jean', bottomSize: '32x32', outerId: null, outerSize: null, onepieceId: null, onepieceSize: null }, body, pref, unisexTops);
    expect(worn.bottomId).toBe('corvo-slim-jean');
  });
});

describe('resolveOutfit prefers a garment with a photo the mannequin can show', () => {
  const tops = garmentsByCategory('top');
  const firstPhotoTop = tops.find((g) => canWarp(g.image))!;

  it('picks the first shown top with an own or brand-permission photo over the first top', () => {
    expect(canWarp(tops[0]!.image)).toBe(false); // the plain rule would pick this one
    const o = resolveOutfit(EMPTY_OUTFIT, body, pref, tops);
    expect(o.topId).toBe(firstPhotoTop.id);
    expect(o.topSize).toBe(defaultSize(body, firstPhotoTop, pref));
  });

  it('skips photos the app may not warp (local-only, affiliate-unaltered)', () => {
    const localOnly = tops.find((g) => g.image?.licence === 'local-only')!;
    const plain = tops.find((g) => !g.image)!;
    const o = resolveOutfit(EMPTY_OUTFIT, body, pref, [localOnly, plain]);
    expect(o.topId).toBe(localOnly.id); // no warpable photo: first shown, as before
  });

  it('falls back to the first shown garment when none has a photo', () => {
    const plain = tops.filter((g) => !g.image);
    expect(resolveOutfit(EMPTY_OUTFIT, body, pref, plain).topId).toBe(plain[0]!.id);
  });

  it('never swaps out a valid saved garment for a photo one', () => {
    const saved = { topId: 'knightweave-tee', topSize: 'M', bottomId: null, bottomSize: null, outerId: null, outerSize: null, onepieceId: null, onepieceSize: null };
    expect(resolveOutfit(saved, body, pref, tops).topId).toBe('knightweave-tee');
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

describe('the jacket slot', () => {
  const jacket = findGarment('port-authority-j317')!;

  it('starts empty: nothing puts a jacket on by default', () => {
    const o = resolveOutfit(EMPTY_OUTFIT, body, pref);
    expect(o.outerId).toBeNull();
    expect(o.outerSize).toBeNull();
  });

  it('keeps a worn jacket, fixes its size, and drops an unknown or misfiled one', () => {
    const base = resolveOutfit(EMPTY_OUTFIT, body, pref);
    expect(resolveOutfit({ ...base, outerId: jacket.id, outerSize: 'XL', onepieceId: null, onepieceSize: null }, body, pref).outerSize).toBe('XL');
    const fixed = resolveOutfit({ ...base, outerId: jacket.id, outerSize: '99', onepieceId: null, onepieceSize: null }, body, pref);
    expect(jacket.sizes.map((s) => s.label)).toContain(fixed.outerSize);
    expect(resolveOutfit({ ...base, outerId: 'gone', outerSize: 'M', onepieceId: null, onepieceSize: null }, body, pref).outerId).toBeNull();
    expect(resolveOutfit({ ...base, outerId: 'knightweave-tee', outerSize: 'M', onepieceId: null, onepieceSize: null }, body, pref).outerId).toBeNull();
  });

  it('puts a jacket on in its own slot, keeping the top', () => {
    const current = resolveOutfit(EMPTY_OUTFIT, body, pref);
    expect(wearGarment(current, jacket, 'L')).toEqual({ ...current, outerId: jacket.id, outerSize: 'L', onepieceId: null, onepieceSize: null });
  });

  it('never starts the top or bottom slot with a jacket', () => {
    expect(firstGarment([jacket, ...garmentsByCategory('top')], 'top')!.category).toBe('top');
  });
});

describe('the dress slot', () => {
  const woman = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' });
  const dress = findGarment('landsend-sheath-dress')!;
  const jacket = findGarment('port-authority-l317')!;
  const tee = findGarment('knightweave-tee')!;
  const skirt = findGarment('landsend-a-line-skirt')!;

  it('starts empty', () => {
    const o = resolveOutfit(EMPTY_OUTFIT, woman, pref);
    expect(o.onepieceId).toBeNull();
    expect(o.topId).not.toBeNull();
  });

  it('takes both the top and the bottom, and keeps the jacket', () => {
    const start = { ...resolveOutfit(EMPTY_OUTFIT, woman, pref), outerId: jacket.id, outerSize: 'M', onepieceId: null, onepieceSize: null };
    const o = wearGarment(start, dress, '10');
    expect(o).toMatchObject({ onepieceId: dress.id, onepieceSize: '10', topId: null, topSize: null, bottomId: null, bottomSize: null });
    expect(o.outerId).toBe(jacket.id);
    expect(resolveOutfit(o, woman, pref)).toEqual(o);
  });

  it('comes off for a top, and the bottom is filled again', () => {
    const o = wearGarment(wearGarment(EMPTY_OUTFIT, dress, '10'), tee, 'M');
    expect(o.onepieceId).toBeNull();
    expect(o.topId).toBe(tee.id);
    expect(resolveOutfit(o, woman, pref).bottomId).not.toBeNull();
  });

  it('comes off for a bottom, and the top is filled again', () => {
    const o = wearGarment(wearGarment(EMPTY_OUTFIT, dress, '10'), skirt, '8');
    expect(o.onepieceId).toBeNull();
    expect(resolveOutfit(o, woman, pref).topId).not.toBeNull();
  });

  it('fixes a dress size and drops an unknown or misfiled dress', () => {
    const worn = wearGarment(EMPTY_OUTFIT, dress, '99');
    expect(dress.sizes.map((s) => s.label)).toContain(resolveOutfit(worn, woman, pref).onepieceSize);
    const gone = resolveOutfit({ ...EMPTY_OUTFIT, onepieceId: 'gone', onepieceSize: '8' }, woman, pref);
    expect(gone.onepieceId).toBeNull();
    expect(gone.topId).not.toBeNull();
    expect(resolveOutfit({ ...EMPTY_OUTFIT, onepieceId: tee.id, onepieceSize: 'M' }, woman, pref).onepieceId).toBeNull();
  });
});
