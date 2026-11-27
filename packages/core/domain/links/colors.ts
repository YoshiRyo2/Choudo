/**
 * A brand's colour name ("DARK GRAY") as a hex to draw the garment in. Pure.
 *
 * Names are Uniqlo's (US site, checked 27 Nov 2026 across 30 tops). Each base is a
 * drawing colour, picked by eye to read as that colour on the mannequin; DARK and LIGHT
 * mix it towards black or white. An unknown name draws in the neutral FETCHED_COLOR.
 */

/** Drawn colour for a fetched garment whose colour we can't name. Never the brand photo. */
export const FETCHED_COLOR = '#a39e96';

/** Base colour names → hex. Two-word bases (OFF WHITE) are looked up before modifiers. */
export const COLOR_BASES: Readonly<Record<string, string>> = {
  WHITE: '#f4f3ef',
  'OFF WHITE': '#ece6d8',
  NATURAL: '#e3d9c4',
  CREAM: '#efe6cc',
  BEIGE: '#cdb796',
  KHAKI: '#a8986a',
  BROWN: '#7a5638',
  BLACK: '#232326',
  GRAY: '#8f9196',
  NAVY: '#263452',
  BLUE: '#3f6db3',
  GREEN: '#3f7a4f',
  OLIVE: '#6b6b3a',
  YELLOW: '#e6c34a',
  ORANGE: '#e07a32',
  RED: '#b8302f',
  WINE: '#6e2433',
  PINK: '#e5a3b4',
  PURPLE: '#6c4c8c',
};

/** Other spellings of a base. */
const ALIASES: Readonly<Record<string, string>> = { GREY: 'GRAY', 'OFF-WHITE': 'OFF WHITE', OFFWHITE: 'OFF WHITE' };

/** How far DARK mixes towards black, and LIGHT towards white. */
export const DARK_MIX = 0.35;
export const LIGHT_MIX = 0.45;

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** `hex` moved `t` of the way to `towards`. */
export const mixHex = (hex: string, towards: string, t: number): string => {
  const a = channels(hex);
  const b = channels(towards);
  return toHex(a.map((v, i) => v + (b[i]! - v) * t));
};

const base = (name: string): string | undefined => COLOR_BASES[ALIASES[name] ?? name];

/** The hex to draw a colour name in: a base, DARK / LIGHT + a base, or FETCHED_COLOR. */
export function colorHex(name: string): string {
  const n = name.trim().toUpperCase().replace(/\s+/g, ' ');
  const whole = base(n);
  if (whole) return whole;
  const [modifier, ...rest] = n.split(' ');
  const b = base(rest.join(' '));
  if (b && modifier === 'DARK') return mixHex(b, '#000000', DARK_MIX);
  if (b && modifier === 'LIGHT') return mixHex(b, '#ffffff', LIGHT_MIX);
  return FETCHED_COLOR;
}
