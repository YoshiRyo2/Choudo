import { describe, expect, it } from 'vitest';
import { HOP_KEYFRAMES, HOP_TIMING } from './motion';

describe('the hop', () => {
  it('moves the figure up 7 px and back over 380 ms', () => {
    expect(HOP_KEYFRAMES.map((k) => k.transform)).toEqual(['translateY(0)', 'translateY(-7px)', 'translateY(0)']);
    expect(HOP_TIMING.duration).toBe(380);
  });

  it('only translates: the body is never scaled, rotated or skewed', () => {
    for (const k of HOP_KEYFRAMES) {
      expect(String(k.transform)).toMatch(/^translateY\(-?\d+(px)?\)$/);
      expect(Object.keys(k).filter((p) => !['transform', 'offset', 'easing'].includes(p))).toEqual([]);
    }
  });
});
