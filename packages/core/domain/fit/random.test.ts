import { describe, expect, it } from 'vitest';
import { keyedSeed, seededRng } from './random';

describe('keyedSeed', () => {
  it('is stable and differs per key and per seed', () => {
    expect(keyedSeed(1, 'thighCm')).toBe(keyedSeed(1, 'thighCm'));
    expect(keyedSeed(1, 'thighCm')).not.toBe(keyedSeed(1, 'kneeCm'));
    expect(keyedSeed(1, 'thighCm')).not.toBe(keyedSeed(2, 'thighCm'));
  });

  it('gives a 32-bit unsigned seed whose streams differ', () => {
    const s = keyedSeed(20261118, 'legOpening');
    expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
    expect(seededRng(s)()).not.toBe(seededRng(keyedSeed(20261118, 'thigh'))());
  });
});
