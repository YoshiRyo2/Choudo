import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../../domain/body';
import { findGarment, NECKLINES, type Garment, type Neckline } from '../../../../domain/garments';
import { bodyGeometry } from '../geometry';
import { topShape } from '../topShape';

/** Gildan 5000 (a crew-neck tee) given each neckline: only the neckline may differ. */
const tee = findGarment('gildan-5000')!;
const as = (neckline: Neckline | undefined): Garment => ({ ...tee, ...(neckline ? { neckline } : {}) });
const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' }).measurements;
const g = bodyGeometry(body);
const size = tee.sizes.find((s) => s.label === 'L')!.measurements;
const draw = (neckline: Neckline | undefined, view: 'front' | 'back' = 'front', at = g, m = body) =>
  topShape(at, as(neckline), size, m.chestCm, m, { view });

describe('necklines (front only; crew is the shape every top had)', () => {
  for (const n of NECKLINES) {
    it(`${n}: snapshot`, () => {
      const s = draw(n);
      expect(JSON.stringify({ body: s.body, neck: s.neck ?? null, collar: s.landmarks.collarRight, neckFront: s.landmarks.neckFront })).toMatchSnapshot();
    });
  }

  it('crew is exactly the shape with no neckline set', () => {
    expect(draw('crew')).toEqual(draw(undefined));
  });

  it('only the neckline differs: sleeves, folds, hem and pins stay put', () => {
    const crew = draw('crew');
    for (const n of NECKLINES) {
      const s = draw(n);
      expect(s.sleeves, n).toEqual(crew.sleeves);
      expect(s.folds, n).toEqual(crew.folds);
      expect(s.markers, n).toEqual(crew.markers);
      expect(s.right, n).toEqual(crew.right);
    }
  });

  it('each one is the shape it says', () => {
    const crew = draw('crew').landmarks;
    const at = (n: Neckline) => draw(n).landmarks;
    // V: same shoulder line, a much deeper point.
    expect(at('v').collarRight).toEqual(crew.collarRight);
    expect(at('v').neckFront.y).toBeGreaterThan(crew.neckFront.y + 3);
    // Scoop: wider and deeper than crew, not as deep as the V.
    expect(at('scoop').collarRight.x).toBeGreaterThan(crew.collarRight.x + 2);
    expect(at('scoop').neckFront.y).toBeGreaterThan(crew.neckFront.y);
    expect(at('scoop').neckFront.y).toBeLessThan(at('v').neckFront.y);
    // Boat: much wider, out towards the shoulder, and shallow.
    expect(at('boat').collarRight.x).toBeGreaterThan(at('scoop').collarRight.x);
    expect(at('boat').collarRight.x).toBeLessThan(g.half.shoulder);
    expect(at('boat').neckFront.y - at('boat').collarRight.y).toBeLessThan(crew.neckFront.y - crew.collarRight.y);
    // Mock: the band stands up the neck, above the neck base and clear of the chin.
    expect(at('mock').neckFront.y).toBeLessThan(g.y.neckBase);
    expect(at('mock').neckFront.y).toBeGreaterThanOrEqual(g.y.chin + 2);
    expect(draw('mock').neck?.lines).toHaveLength(1);
    // Henley: a crew with a placket and three buttons below the neckline.
    expect(at('henley')).toEqual(crew);
    const henley = draw('henley').neck!;
    expect(henley.lines).toHaveLength(1);
    expect(henley.buttons).toHaveLength(3);
    for (const b of henley.buttons) expect(b.y).toBeGreaterThan(crew.neckFront.y);
    expect(draw('crew').neck).toBeUndefined();
  });

  it('the back view is drawn as before, whatever the neckline', () => {
    const back = draw(undefined, 'back');
    for (const n of NECKLINES) expect(draw(n, 'back'), n).toEqual(back);
  });

  it('scales with the body', () => {
    const tall = estimateBody({ heightCm: 196, weightKg: 95, bodyType: 'mens' }).measurements;
    const gt = bodyGeometry(tall);
    const depth = (n: Neckline, at = g, m = body) => draw(n, 'front', at, m).landmarks.neckFront.y - at.y.neckBase;
    expect(depth('v', gt, tall)).toBeGreaterThan(depth('v'));
    expect(depth('scoop', gt, tall)).toBeGreaterThan(depth('scoop'));
  });
});
