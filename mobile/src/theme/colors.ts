/**
 * Choudo's palette, copied from app/src/ui/styles.css :root (the source of truth).
 * Light only, fixed brand colours (no system colours).
 *
 * Colour roles — keep each colour to its job:
 *   brand, peachSoft, peachTint, blush   fills only; never text colours.
 *   stamp          the "Suggested" tag on a size pill.
 *   fit*           fit results only (zone labels, verdicts, size dots, pins).
 *   ink            text, primary buttons, outlines. Muted for secondary text.
 * Contrast: ink is >= 7.4:1 on every fill. Muted, fit* and stamp are >= 4.5:1 on bg,
 * surface and form only (muted also on peachTint); never put them on peachSoft,
 * brand or blush. No gradients, no blur, no grey shadows: raise things with a line border.
 */
export const colors = {
  bg: '#fff4ee',
  surface: '#ffffff',
  ink: '#2a2140',
  muted: '#6b5f73',
  brand: '#ffb59e',
  peachSoft: '#ffcfbd',
  peachTint: '#ffe2d6',
  line: '#ffd6c7',
  blush: '#ff9c86',
  stamp: '#c8372d',
  form: '#fff7f2',
  fitGood: '#2b7353',
  fitWarn: '#a0571a',
  fitBad: '#c2362f',
  /** A primary button that can't act yet: ink 35% over bg (styles.css .button--primary[aria-disabled]). */
  inkDisabled: '#b4aab1',
  /** A field's edge: ink and line half and half, 3:1 on the form fills (styles.css --field-edge). */
  fieldEdge: '#957c84',
  /** Placeholder text (our estimates): muted at 55% on white (NumberInput.css ::placeholder). */
  placeholder: '#aea7b2',
} as const;
