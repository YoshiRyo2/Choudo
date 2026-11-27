import { describe, expect, it } from 'vitest';
import { COLOR_BASES, colorHex, DARK_MIX, FETCHED_COLOR, LIGHT_MIX, mixHex } from './colors';

/** Every colour name seen on 30 Uniqlo US tops (27 Nov 2026). */
const SEEN = [
  'BEIGE', 'BLACK', 'BLUE', 'BROWN', 'CREAM', 'DARK BROWN', 'DARK GRAY', 'DARK GREEN', 'DARK ORANGE', 'DARK PURPLE',
  'GRAY', 'GREEN', 'LIGHT BLUE', 'LIGHT GRAY', 'LIGHT GREEN', 'LIGHT PURPLE', 'NATURAL', 'NAVY', 'OFF WHITE', 'OLIVE',
  'ORANGE', 'PINK', 'PURPLE', 'RED', 'WHITE', 'WINE', 'YELLOW',
];

describe('colorHex', () => {
  it('gives each base its own hex', () => {
    for (const [name, hex] of Object.entries(COLOR_BASES)) {
      expect(colorHex(name), name).toBe(hex);
      expect(hex, name).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(new Set(Object.values(COLOR_BASES)).size).toBe(Object.keys(COLOR_BASES).length);
  });

  it('reads every colour name seen on Uniqlo US, none as unknown', () => {
    for (const name of SEEN) expect(colorHex(name), name).not.toBe(FETCHED_COLOR);
  });

  it('mixes DARK towards black and LIGHT towards white', () => {
    expect(colorHex('DARK GRAY')).toBe(mixHex(COLOR_BASES.GRAY!, '#000000', DARK_MIX));
    expect(colorHex('LIGHT BLUE')).toBe(mixHex(COLOR_BASES.BLUE!, '#ffffff', LIGHT_MIX));
    const lum = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);
    expect(lum(colorHex('DARK GREEN'))).toBeLessThan(lum(colorHex('GREEN')));
    expect(lum(colorHex('LIGHT GREEN'))).toBeGreaterThan(lum(colorHex('GREEN')));
  });

  it('reads a two-word base before a modifier, other spellings and any case or spacing', () => {
    expect(colorHex('OFF WHITE')).toBe(COLOR_BASES['OFF WHITE']);
    expect(colorHex('off-white')).toBe(COLOR_BASES['OFF WHITE']);
    expect(colorHex('  dark   grey ')).toBe(colorHex('DARK GRAY'));
    expect(colorHex('Navy')).toBe(COLOR_BASES.NAVY);
  });

  it('draws an unknown name, or an unknown modifier, in the neutral colour', () => {
    expect(colorHex('09 BLACK MIX')).toBe(FETCHED_COLOR);
    expect(colorHex('DARK')).toBe(FETCHED_COLOR);
    expect(colorHex('DUSTY ROSE')).toBe(FETCHED_COLOR);
    expect(colorHex('BRIGHT RED')).toBe(FETCHED_COLOR);
    expect(colorHex('')).toBe(FETCHED_COLOR);
  });
});

describe('mixHex', () => {
  it('moves each channel the given share of the way', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#336699', '#336699', 0.7)).toBe('#336699');
    expect(mixHex('#ff0000', '#000000', 1)).toBe('#000000');
  });
});
