import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  cleanCutOut,
  erode,
  fillHoles,
  largestRegion,
  medianColour,
  outputScale,
  padNearest,
  threshold,
} from './photo-mask.mjs';

/** Rows of '#' (garment) and '.' (background) -> { mask, w, h }. */
function grid(...rows) {
  const h = rows.length;
  const w = rows[0].length;
  const mask = new Uint8Array(w * h);
  rows.forEach((row, y) => [...row].forEach((c, x) => { mask[y * w + x] = c === '#' ? 1 : 0; }));
  return { mask, w, h };
}
const show = (mask, w) => {
  const rows = [];
  for (let i = 0; i < mask.length; i += w) rows.push([...mask.slice(i, i + w)].map((v) => (v ? '#' : '.')).join(''));
  return rows;
};

describe('threshold', () => {
  it('keeps alpha at or above the cut', () => {
    expect([...threshold(Uint8Array.from([0, 127, 128, 255]))]).toEqual([0, 0, 1, 1]);
  });
});

describe('largestRegion', () => {
  it('drops smaller pieces', () => {
    const { mask, w, h } = grid('##...', '##..#', '.....', '###..', '###..');
    expect(show(largestRegion(mask, w, h), w)).toEqual(['.....', '.....', '.....', '###..', '###..']);
  });
  it('returns an empty mask for an empty input', () => {
    const { mask, w, h } = grid('...', '...');
    expect([...largestRegion(mask, w, h)].every((v) => v === 0)).toBe(true);
  });
});

describe('fillHoles', () => {
  it('fills enclosed background but not notches open to the border', () => {
    const { mask, w, h } = grid('#####.', '#...#.', '#####.', '##.###', '##.###');
    expect(show(fillHoles(mask, w, h), w)).toEqual(['#####.', '#####.', '#####.', '##.###', '##.###']);
  });
});

describe('erode', () => {
  it('peels r px off every side', () => {
    const { mask, w, h } = grid('.......', '.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '.......');
    expect(show(erode(mask, w, h, 1), w)).toEqual([
      '.......', '.......', '..###..', '..###..', '..###..', '.......', '.......',
    ]);
    expect(show(erode(mask, w, h, 2), w)).toEqual([
      '.......', '.......', '.......', '...#...', '.......', '.......', '.......',
    ]);
  });
  it('treats the image edge as background', () => {
    const { mask, w, h } = grid('###', '###', '###');
    expect(show(erode(mask, w, h, 1), w)).toEqual(['...', '.#.', '...']);
  });
  it('does nothing for r = 0', () => {
    const { mask, w, h } = grid('.#.', '###');
    expect(show(erode(mask, w, h, 0), w)).toEqual(['.#.', '###']);
  });
});

describe('padNearest', () => {
  it('copies the nearest garment colour outward, pad px deep, and leaves the rest clear', () => {
    // 5×1 strip: garment at x = 1 (red) and x = 3 (blue).
    const { mask, w, h } = grid('.#.#.');
    const rgb = Uint8Array.from([0, 0, 0, 255, 0, 0, 9, 9, 9, 0, 0, 255, 0, 0, 0]);
    const out = padNearest(rgb, 3, mask, w, h, 1);
    const px = (x) => [...out.slice(x * 4, x * 4 + 4)];
    expect(px(0)).toEqual([255, 0, 0, 255]); // next to red
    expect(px(1)).toEqual([255, 0, 0, 255]);
    expect(px(3)).toEqual([0, 0, 255, 255]);
    expect(px(4)).toEqual([0, 0, 255, 255]); // next to blue
    expect(px(2)[3]).toBe(255); // between them: one of the two, never the photo's grey
    expect(px(2).slice(0, 3)).not.toEqual([9, 9, 9]);
  });
  it('stops at pad px', () => {
    const { mask, w, h } = grid('#....');
    const rgb = new Uint8Array(15).fill(200);
    const out = padNearest(rgb, 3, mask, w, h, 2);
    expect([0, 1, 2, 3, 4].map((x) => out[x * 4 + 3])).toEqual([255, 255, 255, 0, 0]);
  });
});

describe('boundingBox and outputScale', () => {
  it('finds the garment box', () => {
    const { mask, w, h } = grid('.....', '..##.', '.###.', '.....');
    expect(boundingBox(mask, w, h)).toEqual({ left: 1, top: 1, width: 3, height: 2 });
    expect(boundingBox(new Uint8Array(4), 2, 2)).toBeNull();
  });
  it('shrinks the longest side to fit the margin, never enlarges', () => {
    expect(outputScale({ width: 2000, height: 1000 }, 900, 50)).toBeCloseTo(0.4);
    expect(outputScale({ width: 200, height: 100 }, 900, 50)).toBe(1);
  });
});

describe('medianColour', () => {
  it('takes the median of garment pixels only', () => {
    const rgba = Uint8Array.from([10, 20, 30, 255, 12, 22, 32, 255, 200, 200, 200, 255, 11, 21, 31, 255]);
    expect(medianColour(rgba, Uint8Array.from([1, 1, 0, 1]))).toBe('#0b151f');
    expect(medianColour(rgba, new Uint8Array(4))).toBeNull();
  });
});

describe('cleanCutOut', () => {
  it('drops stray specks, fills holes, erodes the fringe and pads it with garment colour', () => {
    const w = 12, h = 12;
    const alpha = new Uint8Array(w * h);
    const rgb = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const garment = x >= 2 && x <= 9 && y >= 2 && y <= 9;
        const fringe = garment && (x === 2 || x === 9 || y === 2 || y === 9);
        const hole = x === 5 && y === 5;
        alpha[i] = garment && !hole ? 255 : 0;
        // Fringe pixels are floor-brown; the garment is green.
        const c = fringe ? [120, 70, 30] : garment ? [0, 160, 0] : [120, 70, 30];
        rgb.set(c, i * 3);
      }
    }
    alpha[0] = 255; // a speck of something else
    const { rgba, mask } = cleanCutOut(rgb, 3, alpha, w, h, { erodePx: 1, padPx: 2 });
    expect(mask[0]).toBe(0);
    expect(mask[5 * w + 5]).toBe(1); // hole filled
    expect(mask[2 * w + 2]).toBe(0); // fringe eroded
    // The fringe is now padding, in garment green.
    expect([...rgba.slice((2 * w + 5) * 4, (2 * w + 5) * 4 + 4)]).toEqual([0, 160, 0, 255]);
    // Far outside stays transparent.
    expect(rgba[(0 * w + 11) * 4 + 3]).toBe(0);
  });
});
