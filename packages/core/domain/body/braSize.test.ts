import { describe, expect, it } from 'vitest';
import { inToCm } from '../units';
import { braSizeProblem, braSizeText, bustFromBraCm, cupInches, parseBraSize } from './braSize';

describe('parseBraSize', () => {
  it('reads band and cup in the usual ways of writing them', () => {
    expect(parseBraSize('34C', 'us')).toEqual({ ok: true, value: { band: 34, cup: 'C', system: 'us' } });
    expect(parseBraSize(' 36 dd ', 'uk')).toEqual({ ok: true, value: { band: 36, cup: 'DD', system: 'uk' } });
    expect(parseBraSize('32-DDD', 'us')).toEqual({ ok: true, value: { band: 32, cup: 'DDD', system: 'us' } });
  });

  it('says what is wrong with anything else', () => {
    expect(parseBraSize('C34', 'us')).toMatchObject({ ok: false, message: expect.stringMatching(/like 34C/) });
    expect(parseBraSize('34', 'us').ok).toBe(false);
    expect(parseBraSize('', 'us').ok).toBe(false);
    expect(parseBraSize('60B', 'us')).toMatchObject({ ok: false, message: 'Band should be between 26 and 50.' });
    expect(parseBraSize('34FF', 'us')).toMatchObject({ ok: false, message: expect.stringMatching(/^FF isn't a US cup size/) });
  });
});

describe('cupInches', () => {
  it('counts one inch per letter: AA 0, A 1, B 2 …', () => {
    expect(['AA', 'A', 'B', 'C', 'D'].map((c) => cupInches(c, 'us'))).toEqual([0, 1, 2, 3, 4]);
    expect(['AA', 'A', 'B', 'C', 'D'].map((c) => cupInches(c, 'uk'))).toEqual([0, 1, 2, 3, 4]);
  });

  it('parts US and UK letters after D', () => {
    expect(cupInches('DD', 'us')).toBe(5);
    expect(cupInches('E', 'us')).toBe(5); // US E = DD
    expect(cupInches('DDD', 'us')).toBe(6);
    expect(cupInches('F', 'us')).toBe(6); // US F = DDD
    expect(cupInches('G', 'us')).toBe(7);
    expect(cupInches('E', 'uk')).toBe(6); // UK E = US DDD
    expect(cupInches('FF', 'uk')).toBe(8);
    expect(cupInches('G', 'uk')).toBe(9);
    expect(cupInches('DDD', 'uk')).toBeUndefined();
    expect(cupInches('c', 'us')).toBe(3);
  });
});

describe('bustFromBraCm', () => {
  it('is band + cup, in inches, converted to cm', () => {
    expect(bustFromBraCm({ band: 34, cup: 'C', system: 'us' })).toBeCloseTo(inToCm(37));
    expect(bustFromBraCm({ band: 32, cup: 'E', system: 'uk' })).toBeCloseTo(inToCm(38));
    expect(bustFromBraCm({ band: 32, cup: 'E', system: 'us' })).toBeCloseTo(inToCm(37));
  });
});

describe('braSizeProblem / braSizeText', () => {
  it('accepts a normal size and names it', () => {
    expect(braSizeProblem({ band: 36, cup: 'B', system: 'uk' })).toBeNull();
    expect(braSizeText({ band: 36, cup: 'B', system: 'uk' })).toBe('36B (UK)');
  });

  it('rejects half bands', () => {
    expect(braSizeProblem({ band: 34.5, cup: 'B', system: 'us' })).toMatch(/^Band/);
  });
});
