// The dashed outline `npm run photos -- --overlay` draws through a photo's
// landmarks, round the garment as you look at it. Pure.

/** A top's points, clockwise from the right collar; the last is the neckline's centre. */
const TOP_ROUND = [
  'collarRight', 'shoulderRight', 'sleeveOuterRight', 'sleeveInnerRight', 'armpitRight', 'hemRight',
  'hemLeft', 'armpitLeft', 'sleeveInnerLeft', 'sleeveOuterLeft', 'shoulderLeft', 'collarLeft',
];

/** A pair of pants, clockwise from the band's left corner (the picker's order). */
const PANTS_ROUND = [
  'waistLeft', 'waistMid', 'waistRight', 'hipRight', 'kneeOuterRight', 'hemOuterRight', 'hemInnerRight',
  'kneeInnerRight', 'crotch', 'kneeInnerLeft', 'hemInnerLeft', 'hemOuterLeft', 'kneeOuterLeft', 'hipLeft',
];

/**
 * SVG polygon points through a photo's landmarks: a pair of pants', or a top's
 * closed at its front neck (front photo) or back neck (back photo).
 * @param {Record<string, { x: number, y: number }>} lm
 */
export function overlayOutline(lm) {
  const names = 'crotch' in lm ? PANTS_ROUND : [...TOP_ROUND, 'neckFront' in lm ? 'neckFront' : 'neckBack'];
  return names.map((n) => `${lm[n].x},${lm[n].y}`).join(' ');
}
