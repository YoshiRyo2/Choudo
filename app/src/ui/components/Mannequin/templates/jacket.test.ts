import { describe, expect, it } from 'vitest';
import { estimateBody } from '@choudo/core/domain/body';
import { hpsLengthCm, layerAllowanceCm, layerGrowCm } from '@choudo/core/domain/fit';
import { findGarment, type Garment } from '@choudo/core/domain/garments';
import { JACKET } from '@choudo/core/domain/garments/testFixtures';
import { bodyGeometry, bodyHalfAt, limbPath } from '../geometry';
import { DRAPE, topShape } from '../topShape';
import { envelopeGeometry, jacketShape } from './jacket';

const m = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' }).measurements;
const g = bodyGeometry(m);
const hoodie = findGarment('gildan-18500')!;
const tee = findGarment('gildan-5000')!;
const sizeOf = (garment: Garment, label: string) => garment.sizes.find((s) => s.label === label)!.measurements;
const drawTop = (garment: Garment, label: string) => topShape(g, garment, sizeOf(garment, label), m.chestCm, m);
const under = (garment: Garment, label: string) => ({ shape: drawTop(garment, label), layer: { garment, sizeLabel: label } });
const jacket = (label: string, over: ReturnType<typeof under> | null = null) => jacketShape(g, m, JACKET, sizeOf(JACKET, label), over);
const sideAt = (s: { right: { sideSeam: { x: number; y: number }[] } }, y: number) => {
  const pts = s.right.sideSeam;
  let x = pts[0]!.x;
  for (let i = 1; i < pts.length; i++) if (y >= pts[i - 1]!.y && y <= pts[i]!.y) x = pts[i - 1]!.x + ((pts[i]!.x - pts[i - 1]!.x) * (y - pts[i - 1]!.y)) / (pts[i]!.y - pts[i - 1]!.y || 1);
  return x;
};

describe('envelopeGeometry', () => {
  it('is the body itself with nothing under the jacket', () => {
    expect(envelopeGeometry(g, null, 0)).toBe(g);
  });

  it('grows the torso to the layer under it, plus its bulk, and keeps the body below its hem', () => {
    const h = under(hoodie, 'XL');
    const grow = layerGrowCm(hoodie);
    const e = envelopeGeometry(g, { shape: h.shape, garment: hoodie }, grow);
    expect(e.half.chest).toBeCloseTo(Math.max(g.half.chest, sideAt(h.shape, g.y.chest)) + grow, 6);
    expect(e.half.shoulder).toBeCloseTo(Math.max(g.half.shoulder, h.shape.right.seam.x) + grow, 6);
    expect(bodyHalfAt(e, g.y.waist)).toBeGreaterThan(bodyHalfAt(g, g.y.waist));
    const below = h.shape.right.hem.y + 5;
    expect(bodyHalfAt(e, below)).toBeCloseTo(bodyHalfAt(g, below), 6);
    expect(e.arm.halfTop).toBeGreaterThan(g.arm.halfTop);
  });

  it('leaves the arm alone under a short-sleeve tee', () => {
    const t = under(tee, 'L');
    const e = envelopeGeometry(g, { shape: t.shape, garment: tee }, layerGrowCm(tee));
    expect(e.arm).toEqual(g.arm);
  });
});

describe('jacketShape', () => {
  it('draws the same as topShape with nothing under it, plus a placket and collar', () => {
    const alone = jacket('M');
    const plain = topShape(g, JACKET, sizeOf(JACKET, 'M'), m.chestCm, m);
    expect(alone.body).toBe(plain.body);
    expect(alone.placket).toMatch(/^M/);
    expect(alone.collar).toMatch(/^M/);
  });

  it('hangs its hem the chart length below the high shoulder point (skin rule)', () => {
    const s = jacket('M', under(hoodie, 'L'));
    expect(s.markers.length!.y).toBeCloseTo(g.y.hps + hpsLengthCm(JACKET, sizeOf(JACKET, 'M'))! * DRAPE, 6);
  });

  it('hangs off a hoodie: its sides at the chest stand outside the hoodie’s', () => {
    const h = under(hoodie, 'XL');
    const s = jacket('M', h);
    expect(sideAt(s, g.y.chest)).toBeGreaterThanOrEqual(sideAt(h.shape, g.y.chest) + layerGrowCm(hoodie));
    expect(s.right.sleeveOuterMid.x).toBeGreaterThan(h.shape.right.sleeveOuterMid.x);
  });

  it('compares its chest with the body plus the layer, as the fit does', () => {
    const h = under(hoodie, 'XL');
    expect(jacketShape(g, m, JACKET, sizeOf(JACKET, 'S'), h).strain.length).toBeGreaterThanOrEqual(
      jacket('S').strain.length,
    );
    expect(layerAllowanceCm(m, h.layer).chestCm).toBeGreaterThan(1.5);
  });

  it('barely moves over a tee', () => {
    const s = jacket('M', under(tee, 'M'));
    expect(Math.abs(sideAt(s, g.y.chest) - sideAt(jacket('M'), g.y.chest))).toBeLessThan(0.5);
  });

  it('leaves a longer hoodie showing below its hem', () => {
    const h = under(hoodie, 'L');
    const s = jacket('S', h);
    expect(h.shape.markers.length!.y).toBeGreaterThan(s.markers.length!.y);
  });
});

describe('jacketShape arms below the cuff', () => {
  it('draws the hand at the body’s width, from the jacket’s cuff, with nothing longer under it', () => {
    const s = jacket('M', under(tee, 'M'));
    expect(s.arms[0]).toBe(limbPath(g.arm, Math.min(s.right.sleeveEndT - 0.04, 1.02), 1.1, 0, 0));
  });

  it('starts below a longer cuff under it, so that cuff stays visible (as the layer note says)', () => {
    const h = under(hoodie, 'L');
    const s = jacket('S', h);
    expect(h.shape.right.sleeveEndT).toBeGreaterThan(s.right.sleeveEndT);
    expect(s.arms[0]).toBe(limbPath(g.arm, Math.min(h.shape.right.sleeveEndT, 1.02), 1.1, 0, 0));
  });
});
