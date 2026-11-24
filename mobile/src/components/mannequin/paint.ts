/**
 * Mannequin.css as SVG props. iOS has no stylesheet, color-mix or filter, so:
 * - color-mix(A p%, transparent) is colour A at opacity p;
 * - color-mix(A p%, B) is a precomputed hex (mixHex);
 * - brightness(0.92) on rib bands is shadeHex;
 * - widths the web gives in px with vector-effect: non-scaling-stroke are functions of
 *   `unit` (view-box units per screen point, px(1, renderedWidth)), so an outline is the
 *   same weight on a small preview and a full-width figure. Widths the web gives in
 *   view-box units (garments, folds, pins, tape) are plain numbers.
 */

import { colors, fonts } from '@/theme';
import { mixHex, shadeHex } from '@/utils/color';

/** The view box is 124 units wide (VIEW.left −62 to VIEW.right 62). */
const VIEW_WIDTH = 124;
/** Assumed until the first layout reports the real width. */
const FALLBACK_WIDTH = 300;

/** `n` screen points in view-box units, for a mannequin rendered `renderedWidth` points wide. */
export function px(n: number, renderedWidth: number): number {
  return (n * VIEW_WIDTH) / (renderedWidth > 0 ? renderedWidth : FALLBACK_WIDTH);
}

const ink = colors.ink;
const round = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const form = (unit: number) => ({
  fill: colors.form,
  stroke: ink,
  strokeWidth: 2.2 * unit,
  strokeLinejoin: 'round' as const,
});

const garment = { stroke: ink, strokeOpacity: 0.55, strokeWidth: 0.35, strokeLinejoin: 'round' as const };

const pinTone = (color: string) => ({
  line: { stroke: color, strokeWidth: 0.45 },
  circle: { fill: color, stroke: colors.bg, strokeWidth: 0.6 },
});

export const paint = {
  /** The cream dress form, 2.2 pt ink outline. */
  form,
  /** Arms a step towards peach, so the torso's shape reads where they overlap. */
  arm: (unit: number) => ({ ...form(unit), fill: mixHex(colors.form, colors.peachTint, 0.55) }),
  seam: (unit: number) => ({
    stroke: ink,
    strokeOpacity: 0.35,
    strokeWidth: 1.2 * unit,
    strokeDasharray: [3 * unit, 4 * unit],
    strokeLinecap: 'round' as const,
  }),
  stand: { fill: ink },

  /** A garment's outline; its fill is the garment's colour. */
  garment,
  /** The width is our guess (girth method unknown): a clear dash. */
  garmentApproximate: { ...garment, strokeDasharray: [1.4, 1], strokeWidth: 0.45 },
  /** Drawn from numbers that include estimates: a fainter, finer dash (stroke-opacity 0.6 on top of the 55%). */
  garmentEstimated: { ...garment, strokeDasharray: [2.4, 1.2], strokeOpacity: 0.55 * 0.6 },
  /** The outline redrawn over a photo texture. */
  garmentEdge: { fill: 'none', ...garment },

  fold: { fill: 'none', stroke: ink, strokeOpacity: 0.22, strokeWidth: 0.35, strokeLinecap: 'round' as const },
  strain: { fill: 'none', stroke: ink, strokeOpacity: 0.3, strokeWidth: 0.25, strokeLinecap: 'round' as const },

  /** Knit rib bands: the garment colour (and the outline) at brightness 0.92. */
  rib: (color: string) => ({
    fill: shadeHex(color, 0.92),
    stroke: shadeHex(ink, 0.92),
    strokeOpacity: 0.55,
    strokeWidth: 0.3,
    strokeLinejoin: 'round' as const,
  }),
  ribLine: { fill: 'none', stroke: ink, strokeOpacity: 0.18, strokeWidth: 0.18, strokeLinecap: 'round' as const },
  placket: { fill: 'none', stroke: ink, strokeOpacity: 0.45, strokeWidth: 0.35 },
  hoodEdge: { fill: 'none', stroke: ink, strokeOpacity: 0.4, strokeWidth: 0.3, strokeLinecap: 'round' as const },
  cord: { fill: 'none', stroke: mixHex(colors.surface, ink, 0.8), strokeWidth: 0.45, strokeLinecap: 'round' as const },

  /** Fit pins. Unknown: a hollow ring, so it reads as "no answer", not broken (its line is the ink text colour). */
  pin: {
    good: pinTone(colors.fitGood),
    warn: pinTone(colors.fitWarn),
    bad: pinTone(colors.fitBad),
    unknown: {
      line: { stroke: ink, strokeWidth: 0.45 },
      circle: { fill: colors.bg, stroke: colors.muted, strokeWidth: 0.5 },
    },
  },

  /** The height tape: a quiet white strip. Text sizes are view-box units. */
  tape: {
    strip: { fill: colors.surface, stroke: colors.line, strokeWidth: 0.3 },
    tick: { stroke: ink, strokeWidth: 0.25 },
    mark: { stroke: ink, strokeWidth: 0.4 },
    num: { fill: ink, fontFamily: fonts.bold, fontSize: 2.6 },
    reading: { fill: ink, fontFamily: fonts.bold, fontSize: 3.6 },
  },

  // Mascot heads. `icon`: the head picker's lighter lines.
  /** Twice the outline under the fills, leaving 2.2 pt round the group. */
  headHalo: (unit: number, icon = false) => ({ fill: ink, stroke: ink, strokeWidth: (icon ? 3 : 4.4) * unit }),
  headFill: { fill: colors.surface },
  headFillPeach: { fill: colors.brand },
  ear: (unit: number, icon = false) => ({
    fill: colors.surface,
    stroke: ink,
    strokeWidth: (icon ? 1.5 : 2.2) * unit,
    strokeLinejoin: 'round' as const,
  }),
  earInner: { fill: colors.brand },
  leaf: (unit: number, icon = false) => ({
    fill: colors.surface,
    stroke: ink,
    strokeWidth: (icon ? 1.5 : 2.2) * unit,
    strokeLinejoin: 'round' as const,
  }),
  crease: (unit: number) => ({
    fill: 'none',
    stroke: ink,
    strokeOpacity: 0.35,
    strokeWidth: 1.6 * unit,
    strokeLinecap: 'round' as const,
  }),
  eye: { fill: ink },
  faceLine: (unit: number, icon = false) => ({ fill: 'none', stroke: ink, strokeWidth: (icon ? 1.4 : 2) * unit, ...round }),
  blush: { fill: colors.blush },
} as const;
