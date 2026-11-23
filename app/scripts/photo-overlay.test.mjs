import { describe, expect, it } from 'vitest';
import { overlayOutline } from './photo-overlay.mjs';

const at = (names) => Object.fromEntries(names.map((n, i) => [n, { x: i, y: 10 * i }]));
const TOP = ['collarLeft', 'collarRight', 'shoulderLeft', 'shoulderRight', 'armpitLeft', 'armpitRight', 'hemLeft', 'hemRight',
  'sleeveOuterLeft', 'sleeveInnerLeft', 'sleeveOuterRight', 'sleeveInnerRight'];

describe('overlayOutline', () => {
  it("closes a front top's outline at the front neck", () => {
    const lm = at([...TOP, 'neckFront']);
    const pts = overlayOutline(lm).split(' ');
    expect(pts).toHaveLength(13);
    expect(pts[0]).toBe(`${lm.collarRight.x},${lm.collarRight.y}`);
    expect(pts.at(-1)).toBe(`${lm.neckFront.x},${lm.neckFront.y}`);
  });

  it("closes a back top's outline at the back neck", () => {
    const lm = at([...TOP, 'neckBack']);
    expect(overlayOutline(lm).split(' ').at(-1)).toBe(`${lm.neckBack.x},${lm.neckBack.y}`);
  });

  it('draws a pair of pants round its 14 points', () => {
    const lm = at(['waistLeft', 'waistMid', 'waistRight', 'hipLeft', 'hipRight', 'crotch', 'kneeOuterLeft', 'kneeInnerLeft',
      'kneeOuterRight', 'kneeInnerRight', 'hemOuterLeft', 'hemInnerLeft', 'hemOuterRight', 'hemInnerRight']);
    const pts = overlayOutline(lm).split(' ');
    expect(pts).toHaveLength(14);
    expect(pts).toContain(`${lm.crotch.x},${lm.crotch.y}`);
  });
});
