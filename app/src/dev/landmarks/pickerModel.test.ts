import { describe, expect, it } from 'vitest';
import { findGarment } from '@choudo/core/domain/garments';
import { PANTS_LANDMARKS, TOP_LANDMARKS } from '@choudo/core/domain/garments/types';
import type { WarpPiece } from '../../ui/components/Mannequin/photoWarp';
import { DIAGRAM, LANDMARK_LABELS, PICKER_KITS, PLACE_ORDER, SHORT_LABELS, foldWarning, kitFor, nextPoint, previewSizes } from './pickerModel';

describe('picker order', () => {
  it('covers every landmark once, with a label and a diagram spot', () => {
    expect([...PLACE_ORDER].sort()).toEqual([...TOP_LANDMARKS].sort());
    for (const n of TOP_LANDMARKS) {
      expect(LANDMARK_LABELS[n]).toBeTruthy();
      expect(DIAGRAM[n]).toBeDefined();
    }
    expect(new Set(Object.values(SHORT_LABELS)).size).toBe(TOP_LANDMARKS.length);
    for (const n of TOP_LANDMARKS) {
      expect(SHORT_LABELS[n]).toBeTruthy();
    }
  });

  it('goes to the next unplaced point, wrapping round', () => {
    expect(nextPoint('collarLeft', {})).toBe('neckFront');
    expect(nextPoint('collarLeft', { neckFront: { x: 1, y: 1 } })).toBe('collarRight');
    expect(nextPoint('shoulderLeft', {})).toBe('collarLeft');
  });

  it('when everything is placed, just moves on round', () => {
    const all = Object.fromEntries(TOP_LANDMARKS.map((n) => [n, { x: 1, y: 1 }]));
    expect(nextPoint('hemRight', all)).toBe('hemLeft');
    expect(nextPoint('shoulderLeft', all)).toBe('collarLeft');
  });
});

describe('previewSizes', () => {
  it('uses the smallest and largest of a sized garment', () => {
    const gildan = findGarment('gildan-5000')!;
    const p = previewSizes(gildan);
    expect(p.labels).toEqual(['S', '5XL']);
    expect(p.madeUp).toBe(false);
    expect(p.garment).toBe(gildan);
  });

  it('adds a made-up bigger size to a one-size garment', () => {
    const henley = findGarment('ryo-black-henley')!;
    const only = henley.sizes[0]!;
    const p = previewSizes(henley);
    expect(p.madeUp).toBe(true);
    expect(p.labels[0]).toBe(only.label);
    const bigger = p.garment.sizes.find((s) => s.label === p.labels[1])!;
    expect(bigger.measurements.chest).toBeCloseTo(only.measurements.chest! + 10);
    expect(bigger.measurements.length).toBeCloseTo(only.measurements.length! + 4);
    // Only measurements the garment has are made up.
    expect(bigger.measurements.inseam).toBeUndefined();
    expect(henley.sizes).toHaveLength(1);
  });
});

describe('foldWarning', () => {
  const piece = (corners: [string, string, string]): WarpPiece => ({
    region: 'body',
    corners,
    transform: { a: -1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    clip: [],
  });
  it('is null when nothing folds', () => {
    expect(foldWarning([])).toBeNull();
  });
  it('names the landmarks once each, in plain words', () => {
    const msg = foldWarning([piece(['neckFront', 'shoulderRight', 'shoulderMid']), piece(['neckFront', 'shoulderLeft', 'shoulderMid'])])!;
    expect(msg).toContain('Front neck, Shoulder, right, the centre line, Shoulder, left');
    expect(msg.match(/Front neck/g)).toHaveLength(1);
  });
});

describe('the pants kit', () => {
  it('places every pants landmark once, round the outline, with words for each', () => {
    const kit = PICKER_KITS.pants;
    expect([...kit.order].sort()).toEqual([...PANTS_LANDMARKS].sort());
    for (const n of PANTS_LANDMARKS) {
      expect(kit.labels[n]).toBeTruthy();
      expect(kit.short[n]).toBeTruthy();
      expect(kit.diagram[n]).toBeDefined();
    }
    expect(new Set(Object.values(kit.short)).size).toBe(PANTS_LANDMARKS.length);
  });

  it('picks the kit by template', () => {
    expect(kitFor(findGarment('corvo-slim-jean')!)).toBe(PICKER_KITS.pants);
    expect(kitFor(findGarment('gildan-5000')!)).toBe(PICKER_KITS.top);
  });

  it('goes round the pants points in order', () => {
    expect(nextPoint('waistLeft', {}, PICKER_KITS.pants.order)).toBe('waistMid');
    expect(nextPoint('hipLeft', {}, PICKER_KITS.pants.order)).toBe('waistLeft');
  });

  it('names pants points and leg edges in a fold warning', () => {
    const w = foldWarning([{ corners: ['crotch', 'legO1Right', 'kneeInnerRight'] } as never])!;
    expect(w).toMatch(/Crotch/);
    expect(w).toMatch(/a leg edge/);
    expect(w).toMatch(/Knee, right, inner/);
  });
});

describe('the back kits', () => {
  const tee = findGarment('gildan-5000')!;
  const jeans = findGarment('corvo-slim-jean')!;
  it('a back top kit places neckBack, not neckFront, with words and a diagram spot', () => {
    const kit = kitFor(tee, 'back');
    expect(kit.order).toHaveLength(13);
    expect(kit.order).toContain('neckBack');
    expect(kit.order).not.toContain('neckFront');
    expect(kit.labels.neckBack).toBe('Back neck: bottom of the back neckline');
    expect(kit.short.neckBack).toBe('Back neck');
    expect(kit.diagram.neckBack).toEqual({ x: 60, y: 15 });
    expect(kitFor(tee, 'front')).toBe(kitFor(tee));
  });

  it('a back pants kit is the front one', () => {
    expect(kitFor(jeans, 'back')).toBe(kitFor(jeans));
  });
});
