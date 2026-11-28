/** Brand wording made readable. Pure. */

/** "OFF WHITE" → "Off White", "INTERLOCK LONG-SLEEVE T-SHIRT" → "Interlock Long-Sleeve T-Shirt". */
export const titleCase = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
