import { describe, expect, it } from 'vitest';
import { findGarment } from '../../domain/garments';
import { TOP_LANDMARKS } from '../../domain/garments/types';
import type { WarpPiece } from '../../ui/components/Mannequin/photoWarp';
import { DIAGRAM, LANDMARK_LABELS, PLACE_ORDER, SHORT_LABELS, foldWarning, nextPoint, previewSizes } from './pickerModel';

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
