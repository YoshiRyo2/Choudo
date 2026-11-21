import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../../domain/body';
import { GARMENTS } from '../../../../domain/garments';
import { bodyGeometry } from '../geometry';
import { BACK_NECKLINE_DIP_CM, topShape } from '../topShape';

/**
 * The back of every top: the same widths, heights and pins as the front (skin
 * rule; the fit doesn't change), with only the neckline and the hood different.
 */
const bodies = [
  estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' }),
  estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }),
];
const tops = GARMENTS.filter((g) => g.category === 'top');

describe('a top from the back', () => {
  for (const body of bodies) {
    const m = body.measurements;
    const g = bodyGeometry(m);
    for (const garment of tops) {
      it(`${garment.id} on ${m.bodyType} ${m.heightCm}/${m.weightKg}: same widths, heights and pins`, () => {
        for (const s of garment.sizes) {
          const front = topShape(g, garment, s.measurements, m.chestCm, m);
          const back = topShape(g, garment, s.measurements, m.chestCm, m, { view: 'back' });
          expect(back.markers).toEqual(front.markers);
          expect(back.sleeveEdges).toEqual(front.sleeveEdges);
          expect(back.sleeveArmpits).toEqual(front.sleeveArmpits);
          expect(back.right).toEqual(front.right);
          expect([back.sleeves, back.arms, back.folds, back.strain, back.rib, back.approximate]).toEqual([
            front.sleeves,
            front.arms,
            front.folds,
            front.strain,
            front.rib,
            front.approximate,
          ]);
          const { neckFront: nb, ...restBack } = back.landmarks;
          const { neckFront: nf, ...restFront } = front.landmarks;
          expect(restBack).toEqual(restFront);
          expect(nb).toEqual({ x: 0, y: g.y.neckBase + BACK_NECKLINE_DIP_CM });
          expect(nb.y).toBeLessThanOrEqual(nf.y);
          expect(back.body).not.toEqual(front.body);
          expect(back.hood).toBeUndefined();
          expect(back.hoodTop).toBeUndefined();
          expect(back.hoodOnBack !== undefined).toBe(garment.type === 'hoodie');
          expect(front.hoodOnBack).toBeUndefined();
          expect(topShape(g, garment, s.measurements, m.chestCm, m, { view: 'front' })).toEqual(front);
        }
      });
    }
  }

  it('a hood lies on the back between the collar points, below the high shoulder point', () => {
    const m = bodies[0]!.measurements;
    const g = bodyGeometry(m);
    const hoodie = tops.find((t) => t.type === 'hoodie')!;
    const back = topShape(g, hoodie, hoodie.sizes[0]!.measurements, m.chestCm, m, { view: 'back' });
    const ys = [...back.hoodOnBack!.matchAll(/-?\d+(?:\.\d+)?/g)].map((x) => Number(x[0])).filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBeGreaterThan(g.y.hps + 10);
  });

  it("keeps a dress bodice's seam from the back", () => {
    const m = bodies[1]!.measurements;
    const g = bodyGeometry(m);
    const tee = tops[0]!;
    const hemAt = { y: g.y.waist, half: 15 };
    const front = topShape(g, tee, tee.sizes[0]!.measurements, m.chestCm, m, { hemAt });
    const back = topShape(g, tee, tee.sizes[0]!.measurements, m.chestCm, m, { hemAt, view: 'back' });
    expect(back.right.hem).toEqual(front.right.hem);
    expect(back.markers).toEqual(front.markers);
  });
});
