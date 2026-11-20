import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../domain/body';
import { findGarment, PANTS_LANDMARKS, topLandmarks } from '../../../domain/garments';
import { bodyGeometry } from './geometry';
import { SLEEVE_STRIPS, applyAffine, foldedPieces, sleeveStrips, triangleAffine, warpPantsPieces, warpPieces, type XY } from './photoWarp';
import { SYNTHETIC_JEANS_LANDMARKS } from './pantsFixture';
import { pantsShape } from './templates/pants';
import { topShape } from './topShape';

const tri = (...p: number[]): [XY, XY, XY] => [
  { x: p[0]!, y: p[1]! },
  { x: p[2]!, y: p[3]! },
  { x: p[4]!, y: p[5]! },
];

describe('triangleAffine', () => {
  it('lands each corner exactly on its partner', () => {
    const from = tri(10, 20, 300, 40, 120, 500);
    const to = tri(-5, 30, 18, 33, 2, 90);
    const m = triangleAffine(from, to)!;
    from.forEach((p, i) => {
      const q = applyAffine(m, p);
      expect(q.x).toBeCloseTo(to[i]!.x, 9);
      expect(q.y).toBeCloseTo(to[i]!.y, 9);
    });
  });

  it('maps the centroid to the centroid', () => {
    const from = tri(0, 0, 100, 0, 0, 100);
    const to = tri(1, 1, 3, 1, 1, 5);
    const c = applyAffine(triangleAffine(from, to)!, { x: 100 / 3, y: 100 / 3 });
    expect(c.x).toBeCloseTo(5 / 3);
    expect(c.y).toBeCloseTo(7 / 3);
  });

  it('refuses a flat photo triangle', () => {
    expect(triangleAffine(tri(0, 0, 10, 10, 20, 20), tri(0, 0, 1, 0, 0, 1))).toBeNull();
  });
});

describe('warpPieces for the Gildan 5000 photo', () => {
  const garment = findGarment('gildan-5000')!;
  const photo = topLandmarks(garment.image!)!;
  const body = estimateBody({ heightCm: 178, weightKg: 75, bodyType: 'mens' }).measurements;
  const g = bodyGeometry(body);

  for (const label of ['S', 'XL', '5XL']) {
    it(`sends every photo landmark to its outline point at ${label}`, () => {
      const size = garment.sizes.find((s) => s.label === label)!.measurements;
      const shape = topShape(g, garment, size, body.chestCm);
      const pieces = warpPieces(photo, shape.landmarks, shape.sleeveEdges);
      expect(pieces.filter((p) => p.region === 'body')).toHaveLength(12);
      // A worn tee photographed with the arms down: no real inner sleeve edge, so one quad per sleeve.
      expect(pieces.filter((p) => p.region === 'sleeveRight')).toHaveLength(2);
      expect(pieces.filter((p) => p.region === 'sleeveLeft')).toHaveLength(2);

      const near = (p: XY, q: XY) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;
      const check = (region: string, name: keyof typeof photo, target: XY) => {
        const hits = pieces
          .filter((p) => p.region === region)
          .map((p) => applyAffine(p.transform, photo[name]))
          .filter((q) => near(q, target));
        expect(hits.length, `${region} ${name}`).toBeGreaterThan(0);
      };
      for (const name of ['collarLeft', 'collarRight', 'neckFront', 'shoulderLeft', 'shoulderRight', 'armpitLeft', 'armpitRight', 'hemLeft', 'hemRight'] as const) {
        check('body', name, shape.landmarks[name]);
      }
      check('sleeveRight', 'sleeveOuterRight', shape.landmarks.sleeveOuterRight);
      check('sleeveRight', 'sleeveInnerRight', shape.landmarks.sleeveInnerRight);
      check('sleeveRight', 'armpitRight', shape.sleeveArmpits.right);
      check('sleeveLeft', 'sleeveOuterLeft', shape.landmarks.sleeveOuterLeft);
      check('sleeveLeft', 'armpitLeft', shape.sleeveArmpits.left);
    });
  }

  it('stretches only the outer pieces past the landmark outline', () => {
    const size = garment.sizes.find((s) => s.label === 'XL')!.measurements;
    const shape = topShape(g, garment, size, body.chestCm);
    const pieces = warpPieces(photo, shape.landmarks, shape.sleeveEdges);
    const torso = pieces.filter((p) => p.region === 'body');
    // The pieces on the centre line under the neck and across the chest touch no outside edge.
    expect(torso.filter((p) => p.clip.length === 3)).toHaveLength(4);
    // Hem pieces reach well below the hem, so a longer drawn hem still gets texture.
    const lowest = Math.max(...torso.flatMap((p) => p.clip.map((q) => q.y)));
    expect(lowest).toBeGreaterThan(shape.landmarks.hemRight.y + 4);
    // Every sleeve piece has an outside edge.
    expect(pieces.filter((p) => p.region !== 'body').every((p) => p.clip.length > 3)).toBe(true);
  });

  it('keeps the photo the right way up and unmirrored', () => {
    const size = garment.sizes.find((s) => s.label === 'M')!.measurements;
    const shape = topShape(g, garment, size, body.chestCm);
    for (const p of warpPieces(photo, shape.landmarks, shape.sleeveEdges)) {
      expect(p.transform.a * p.transform.d - p.transform.b * p.transform.c).toBeGreaterThan(0);
    }
  });
});

describe('warpPieces on a women’s body', () => {
  const garment = findGarment('gildan-5000')!;
  const photo = topLandmarks(garment.image!)!;
  const near = (p: XY, q: XY) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;

  for (const bra of [undefined, { band: 34, cup: 'DD', system: 'us' as const }]) {
    it(`still sends every photo landmark to its outline point${bra ? ' (34DD)' : ''}`, () => {
      const body = estimateBody({ heightCm: 165, weightKg: 62, bodyType: 'womens', overrides: bra ? { braSize: bra } : undefined }).measurements;
      const g = bodyGeometry(body);
      for (const label of ['S', 'L']) {
        const shape = topShape(g, garment, garment.sizes.find((s) => s.label === label)!.measurements, body.chestCm);
        const pieces = warpPieces(photo, shape.landmarks, shape.sleeveEdges);
        for (const name of ['collarLeft', 'collarRight', 'neckFront', 'shoulderLeft', 'shoulderRight', 'armpitLeft', 'armpitRight', 'hemLeft', 'hemRight'] as const) {
          const hit = pieces.some((p) => p.region === 'body' && near(applyAffine(p.transform, photo[name]), shape.landmarks[name]));
          expect(hit, `${label} ${name}`).toBe(true);
        }
        for (const p of pieces) expect(p.transform.a * p.transform.d - p.transform.b * p.transform.c).toBeGreaterThan(0);
      }
    });
  }
});

describe('warpPieces for a long sleeve laid flat (the black henley)', () => {
  const garment = findGarment('ryo-black-henley')!;
  const photo = topLandmarks(garment.image!)!;
  const body = estimateBody({ heightCm: 176, weightKg: 78, bodyType: 'mens' }).measurements;
  const shape = topShape(bodyGeometry(body), garment, garment.sizes[0]!.measurements, body.chestCm);
  const pieces = warpPieces(photo, shape.landmarks, shape.sleeveEdges);

  it('cuts each sleeve into strips', () => {
    expect(sleeveStrips(photo, 'Left')).toBe(SLEEVE_STRIPS);
    expect(pieces.filter((p) => p.region === 'sleeveRight')).toHaveLength(2 * SLEEVE_STRIPS);
    expect(pieces.filter((p) => p.region === 'sleeveLeft')).toHaveLength(2 * SLEEVE_STRIPS);
  });

  it('maps the whole photo sleeve onto the whole drawn sleeve, root to cuff', () => {
    const near = (p: XY, q: XY) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;
    for (const side of ['Left', 'Right'] as const) {
      const region = `sleeve${side}`;
      const edges = side === 'Left' ? shape.sleeveEdges.left : shape.sleeveEdges.right;
      const sends = (from: XY, to: XY) =>
        pieces.some((p) => p.region === region && near(applyAffine(p.transform, from), to));
      expect(sends(photo[`shoulder${side}`], edges.outer[0]!)).toBe(true);
      expect(sends(photo[`sleeveOuter${side}`], edges.outer[SLEEVE_STRIPS]!)).toBe(true);
      expect(sends(photo[`sleeveInner${side}`], edges.inner[SLEEVE_STRIPS]!)).toBe(true);
      // Halfway along the photo's outer edge lands halfway down the drawn sleeve.
      const half = { x: (photo[`shoulder${side}`].x + photo[`sleeveOuter${side}`].x) / 2, y: (photo[`shoulder${side}`].y + photo[`sleeveOuter${side}`].y) / 2 };
      expect(sends(half, edges.outer[SLEEVE_STRIPS / 2]!)).toBe(true);
    }
    // The cuff reaches the wrist end of the arm, well below the armpit.
    expect(shape.sleeveEdges.right.outer[SLEEVE_STRIPS]!.y).toBeGreaterThan(shape.landmarks.hemRight.y - 20);
  });

  it('keeps every piece the right way up', () => {
    for (const p of pieces) expect(p.transform.a * p.transform.d - p.transform.b * p.transform.c).toBeGreaterThan(0);
  });
});

describe('tee warp pieces stay as they were (pinned before the pants warp)', () => {
  const round = (x: unknown) => (typeof x === 'number' ? Number(x.toPrecision(10)) : x);
  for (const id of ['gildan-5000', 'ryo-black-henley', 'ryo-grey-polo']) {
    it(`${id}`, async () => {
      const garment = findGarment(id)!;
      const body = estimateBody({ heightCm: 176, weightKg: 78, bodyType: 'mens' }).measurements;
      const g = bodyGeometry(body);
      const pieces = garment.sizes.map((s) => {
        const shape = topShape(g, garment, s.measurements, body.chestCm);
        return warpPieces(topLandmarks(garment.image!)!, shape.landmarks, shape.sleeveEdges);
      });
      await expect(JSON.stringify(pieces, (_k, v) => round(v))).toMatchFileSnapshot(`./__snapshots__/tee-warp-${id}.json`);
    });
  }
});

describe('warpPantsPieces on a synthetic pair of jeans', () => {
  const jean = findGarment('corvo-slim-jean')!;
  const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' }).measurements;
  const g = bodyGeometry(body);
  const photo = SYNTHETIC_JEANS_LANDMARKS;

  for (const label of ['30x30', '36x32']) {
    const shape = pantsShape(g, body, jean, jean.sizes.find((s) => s.label === label)!.measurements);
    const pieces = warpPantsPieces(photo, shape.landmarks, shape.limbEdges);

    it(`cuts a body and two legs of strips at ${label}`, () => {
      expect(pieces.filter((p) => p.region === 'body')).toHaveLength(4);
      expect(pieces.filter((p) => p.region === 'legRight')).toHaveLength(2 * SLEEVE_STRIPS);
      expect(pieces.filter((p) => p.region === 'legLeft')).toHaveLength(2 * SLEEVE_STRIPS);
    });

    it(`sends every photo landmark to its drawn point at ${label}`, () => {
      const near = (p: XY, q: XY) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;
      for (const name of PANTS_LANDMARKS) {
        const hits = pieces.filter((p) => p.corners.includes(name)).map((p) => applyAffine(p.transform, photo[name]));
        expect(hits.length, name).toBeGreaterThan(0);
        for (const q of hits) expect(near(q, shape.landmarks[name]), name).toBe(true);
      }
    });

    it(`keeps every piece the right way up at ${label}`, () => {
      expect(foldedPieces(pieces)).toEqual([]);
    });
  }
});
