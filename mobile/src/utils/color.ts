/** Colour maths the web does in CSS (color-mix, filter: brightness), which iOS has no stylesheet for. */

const channels = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

const toHex = (rgb: number[]) =>
  `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;

/** `color-mix(in srgb, a <aShare × 100>%, b)`, as lowercase #rrggbb. */
export function mixHex(a: string, b: string, aShare: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return toHex(ca.map((c, i) => c * aShare + cb[i]! * (1 - aShare)));
}

/** `filter: brightness(factor)`: each channel times the factor, clamped. */
export function shadeHex(hex: string, factor: number): string {
  return toHex(channels(hex).map((c) => c * factor));
}
