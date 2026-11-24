import { colors } from '@/theme';
import { mixHex } from '@/utils/color';

import { paint, px } from './paint';

test('px: a screen width in view-box units, from the rendered width (124 units across)', () => {
  expect(px(2.2, 124)).toBeCloseTo(2.2);
  expect(px(2.2, 248)).toBeCloseTo(1.1);
});

test('px: before the first layout, a 300 pt wide figure is assumed', () => {
  expect(px(2.2, 0)).toBeCloseTo((2.2 * 124) / 300);
  expect(px(2.2, -1)).toBeCloseTo((2.2 * 124) / 300);
});

test('the outline is 2.2 pt on screen at any rendered size', () => {
  expect(paint.form(px(1, 124)).strokeWidth).toBeCloseTo(2.2);
  expect(paint.form(px(1, 248)).strokeWidth).toBeCloseTo(1.1);
  expect(paint.form(px(1, 124)).stroke).toBe(colors.ink);
});

test('arms are a step towards peach', () => {
  expect(paint.arm(1).fill).toBe(mixHex(colors.form, colors.peachTint, 0.55));
});

test('garment dashes, in view-box units', () => {
  expect(paint.garment.strokeWidth).toBe(0.35);
  expect(paint.garmentApproximate.strokeDasharray).toEqual([1.4, 1]);
  expect(paint.garmentApproximate.strokeWidth).toBe(0.45);
  expect(paint.garmentEstimated.strokeDasharray).toEqual([2.4, 1.2]);
  // color-mix(ink 55%, transparent) under stroke-opacity 0.6.
  expect(paint.garmentEstimated.strokeOpacity).toBeCloseTo(0.33);
});

test('the seam dash is in screen points too', () => {
  const seam = paint.seam(px(1, 248));
  expect(seam.strokeWidth).toBeCloseTo(0.6);
  expect(seam.strokeDasharray).toEqual([1.5, 2]);
});

test('rib bands are the garment colour at brightness 0.92', () => {
  expect(paint.rib('#ff0000').fill).toBe('#eb0000');
});

test('pins: fit colours, and a hollow ring for unknown', () => {
  expect(paint.pin.good.circle.fill).toBe(colors.fitGood);
  expect(paint.pin.warn.circle.fill).toBe(colors.fitWarn);
  expect(paint.pin.bad.line.stroke).toBe(colors.fitBad);
  expect(paint.pin.unknown.circle).toEqual({ fill: colors.bg, stroke: colors.muted, strokeWidth: 0.5 });
  // The web's line is currentColor under .tone-unknown { color: var(--muted) }.
  expect(paint.pin.unknown.line.stroke).toBe(colors.muted);
});

test('drawcords are surface 80% with ink', () => {
  expect(paint.cord.stroke).toBe(mixHex(colors.surface, colors.ink, 0.8));
});

test('head lines are screen widths; the icon has lighter ones', () => {
  expect(paint.headHalo(1).strokeWidth).toBe(4.4);
  expect(paint.headHalo(1, true).strokeWidth).toBe(3);
  expect(paint.ear(1, true).strokeWidth).toBe(1.5);
  expect(paint.faceLine(0.5).strokeWidth).toBe(1);
  expect(paint.faceLine(1, true).strokeWidth).toBe(1.4);
  expect(paint.headFillPeach.fill).toBe(colors.brand);
});
