import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../domain/body';
import { bodyGeometry } from './geometry';
import { faceShape, HEAD_KINDS, HEAD_SCALE, headAnchor, headShape, headTop, isHeadKind, type HeadShape } from './heads';

const bodies = [
  estimateBody({ heightCm: 152, weightKg: 48, bodyType: 'womens' }).measurements,
  estimateBody({ heightCm: 165, weightKg: 70, bodyType: 'womens' }).measurements,
  estimateBody({ heightCm: 196, weightKg: 110, bodyType: 'mens' }).measurements,
];

describe('mascot heads', () => {
  /** The lowest point a head reaches (largest y). */
  const headBottom = (shape: HeadShape) =>
    Math.max(...shape.puffs.map((c) => c.cy + c.r), ...shape.ears.map(({ outer: e }) => e.cy + Math.max(e.rx, e.ry)));

  it('draws the head HEAD_SCALE times the body geometry’s head', () => {
    expect(HEAD_SCALE).toBe(1.3);
    const g = bodyGeometry(bodies[1]!);
    expect(headAnchor(g.head).w).toBeCloseTo(g.head.rx * HEAD_SCALE, 6);
  });

  it.each(HEAD_KINDS)('the %s head keeps its bottom on the chin: it grows up and out, never down into the neck', (kind) => {
    for (const body of bodies) {
      const g = bodyGeometry(body);
      const chin = g.head.cy + g.head.ry;
      const shape = headShape(kind, headAnchor(g.head));
      expect(headAnchor(g.head).bottom).toBe(chin);
      expect(headBottom(shape)).toBeCloseTo(chin, 1);
      expect(headBottom(shape)).toBeLessThanOrEqual(chin + 0.01);
    }
  });

  it.each(HEAD_KINDS)('the %s head sits on the neck and stays within the old head’s height × HEAD_SCALE', (kind) => {
    for (const body of bodies) {
      const g = bodyGeometry(body);
      const shape = headShape(kind, headAnchor(g.head));
      const face = shape.puffs[0]!;
      // Centred on the body's centre line, its face circle's bottom on the chin line (over the neck's top).
      expect(face.cx).toBeCloseTo(g.head.cx, 1);
      expect(face.cy + face.r).toBeCloseTo(g.head.cy + g.head.ry, 0);
      expect(face.cy + face.r).toBeGreaterThan(g.y.chin - 2);
      // No taller than the head it replaces, scaled up from the chin by HEAD_SCALE.
      const chin = g.head.cy + g.head.ry;
      expect(headTop(shape)).toBeGreaterThanOrEqual(chin - 2 * g.head.ry * HEAD_SCALE - 0.01);
    }
  });

  it('scales with the head size the geometry uses', () => {
    const small = headShape('cloud', { x: 0, bottom: 20, w: 6 });
    const big = headShape('cloud', { x: 0, bottom: 20, w: 9 });
    expect(big.puffs[0]!.r / small.puffs[0]!.r).toBeCloseTo(1.5, 1);
  });

  it('draws a cloud of four puffs, a peach with a leaf and crease, a bunny with two ears', () => {
    const at = { x: 0, bottom: 20, w: 7.6 };
    expect(headShape('cloud', at).puffs).toHaveLength(4);
    const peach = headShape('peach', at);
    expect(peach.puffs).toHaveLength(1);
    expect(peach.leaf).toMatch(/^M.+Z$/);
    expect(peach.crease).toMatch(/^M/);
    const bunny = headShape('bunny', at);
    expect(bunny.puffs).toHaveLength(1);
    expect(bunny.ears).toHaveLength(2);
    // Mirror images of each other.
    expect(bunny.ears[0]!.outer.cx).toBeCloseTo(-bunny.ears[1]!.outer.cx);
    expect(bunny.ears[0]!.outer.rotate).toBe(-bunny.ears[1]!.outer.rotate);
  });

  it('knows its kinds', () => {
    expect(HEAD_KINDS.every(isHeadKind)).toBe(true);
    for (const v of ['Cloud', 'cat', '', null, 1, {}]) expect(isHeadKind(v)).toBe(false);
  });
});

describe('the face', () => {
  const on = { cx: 0, cy: 10, r: 7 };

  it('follows the fit tone', () => {
    const pick = (tone: Parameters<typeof faceShape>[0]) => {
      const f = faceShape(tone, on);
      return [f.eyes, f.mouth];
    };
    expect(pick('good')).toEqual(['closed', 'smile']);
    expect(pick('warn')).toEqual(['dot', 'flat']);
    expect(pick('bad')).toEqual(['dot', 'frown']);
    expect(pick('unknown')).toEqual(['dot', 'flat']);
  });

  it('draws happy closed eyes as two arcs and dot eyes as two dots', () => {
    const happy = faceShape('good', on);
    expect(happy.eyeArcs).toHaveLength(2);
    expect(happy.eyeDots).toHaveLength(0);
    const plain = faceShape('warn', on);
    expect(plain.eyeDots).toHaveLength(2);
    expect(plain.eyeArcs).toHaveLength(0);
  });

  it('curves the mouth up for a smile and down for a frown, straight otherwise', () => {
    // The quadratic's control point: below the ends for a smile, above for a frown.
    const control = (d: string) => d.match(/Q(-?[\d.]+) (-?[\d.]+)/);
    const endY = (d: string) => Number(d.match(/^M-?[\d.]+ (-?[\d.]+)/)![1]);
    const smile = faceShape('good', on).mouthPath;
    const frown = faceShape('bad', on).mouthPath;
    expect(Number(control(smile)![2])).toBeGreaterThan(endY(smile));
    expect(Number(control(frown)![2])).toBeLessThan(endY(frown));
    expect(faceShape('warn', on).mouthPath).toMatch(/^M[^Q]+L/);
  });

  it('has two blush cheeks on every face', () => {
    for (const tone of ['good', 'warn', 'bad', 'unknown'] as const) expect(faceShape(tone, on).blush).toHaveLength(2);
  });
});
