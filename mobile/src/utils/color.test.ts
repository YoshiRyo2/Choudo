import { colors } from '@/theme';

import { mixHex, shadeHex } from './color';

test('mixHex mixes in sRGB like color-mix', () => {
  expect(mixHex('#ffffff', '#000000', 0.5)).toBe('#808080');
  expect(mixHex('#FF0000', '#0000ff', 1)).toBe('#ff0000');
  expect(mixHex('#ff0000', '#0000ff', 0)).toBe('#0000ff');
});

test("mixHex: the arms' fill, form 55% with peach tint", () => {
  // g: 247 × .55 + 226 × .45 = 237.55 → ee; b: 242 × .55 + 214 × .45 = 229.4 → e5.
  expect(mixHex(colors.form, colors.peachTint, 0.55)).toBe('#ffeee5');
});

test('shadeHex scales each channel like CSS brightness(), clamped', () => {
  expect(shadeHex('#ff0000', 0.92)).toBe('#eb0000');
  expect(shadeHex('#808080', 2)).toBe('#ffffff');
  expect(shadeHex('#123456', 0)).toBe('#000000');
});
