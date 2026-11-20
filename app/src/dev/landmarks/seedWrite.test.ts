import { describe, expect, it } from 'vitest';
import { PANTS_LANDMARKS, TOP_LANDMARKS, type GarmentImage, type TopLandmarkName } from '../../domain/garments/types';
import SEED from '../../domain/garments/seed.json?raw';
import { formatImage, licenceForSave, writeGarmentImage } from './seedWrite';

const image = (file: string, shift = 0): GarmentImage => ({
  file,
  licence: 'own',
  photographedSize: null,
  landmarks: Object.fromEntries(TOP_LANDMARKS.map((n, i) => [n, { x: 10 * i + shift + 0.4, y: 5 * i }])) as Record<
    TopLandmarkName,
    { x: number; y: number }
  >,
});

/** Text before and after the first difference between two strings, trimmed to where they agree again. */
function changedRegion(a: string, b: string) {
  let s = 0;
  while (s < a.length && a[s] === b[s]) s++;
  let e = 0;
  while (e < a.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  return { before: a.slice(s, a.length - e), after: b.slice(s, b.length - e), start: s };
}

describe('formatImage', () => {
  it('writes the house style: one landmark per line, whole pixels, TOP_LANDMARKS order', () => {
    const text = formatImage(image('garments/x.png'), '      ');
    const lines = text.split('\n');
    expect(lines[0]).toBe('{');
    expect(lines[1]).toBe('        "file": "garments/x.png",');
    expect(lines[2]).toBe('        "licence": "own",');
    expect(lines[3]).toBe('        "photographedSize": null,');
    expect(lines[5]).toBe('          "collarLeft": { "x": 0, "y": 0 },');
    expect(lines.at(-1)).toBe('      }');
    expect(Object.keys(JSON.parse(text).landmarks)).toEqual([...TOP_LANDMARKS]);
  });
});

describe('writeGarmentImage', () => {
  it('changes only the garment\'s image value, and the JSON only there', () => {
    const next = writeGarmentImage(SEED, 'ryo-black-henley', image('garments/ryo-black-henley-front.png'));
    const { before, after } = changedRegion(SEED, next);
    // The changed text is inside the henley's image value.
    expect(before.length).toBeGreaterThan(0);
    expect(SEED.indexOf(before)).toBeGreaterThan(SEED.indexOf('"id": "ryo-black-henley"'));
    expect(after).not.toContain('"sizes"');

    const old = JSON.parse(SEED);
    const now = JSON.parse(next);
    const i = old.garments.findIndex((g: { id: string }) => g.id === 'ryo-black-henley');
    expect(now.garments[i].image.file).toBe('garments/ryo-black-henley-front.png');
    expect(now.garments[i].image.landmarks.collarLeft).toEqual({ x: 0, y: 0 });
    // Everything else parses the same.
    delete old.garments[i].image;
    delete now.garments[i].image;
    expect(now).toEqual(old);
  });

  it('keeps every byte outside the image value', () => {
    const next = writeGarmentImage(SEED, 'gildan-5000', image('garments/gildan-5000-front.png'));
    const start = SEED.indexOf('"image": {', SEED.indexOf('"id": "gildan-5000"'));
    const end = SEED.indexOf('"sleeve"', start);
    expect(next.slice(0, start)).toBe(SEED.slice(0, start));
    expect(next.slice(next.indexOf('"sleeve"', start))).toBe(SEED.slice(end));
  });

  it('is a no-op when the image is written back unchanged in house style', () => {
    const gildan = JSON.parse(SEED).garments.find((g: { id: string }) => g.id === 'gildan-5000');
    expect(writeGarmentImage(SEED, 'gildan-5000', gildan.image)).toBe(SEED);
  });

  it('adds an image after "color" when the garment has none, matching its indentation', () => {
    const text = [
      '{',
      '  "garments": [',
      '    {',
      '      "id": "a",',
      '      "color": "#fff",',
      '      "sizes": [{ "label": "M", "measurements": {} }]',
      '    },',
      '    { "id": "b", "color": "#000" }',
      '  ]',
      '}',
      '',
    ].join('\n');
    const next = writeGarmentImage(text, 'a', image('garments/a.png'));
    expect(next).toContain('      "color": "#fff",\n      "image": {\n        "file": "garments/a.png",');
    expect(next).toContain('\n      },\n      "sizes": [{ "label": "M", "measurements": {} }]');
    expect(next.endsWith('    { "id": "b", "color": "#000" }\n  ]\n}\n')).toBe(true);
    expect(JSON.parse(next).garments[0].image.landmarks.hemRight).toBeDefined();
    // Last member of a one-line object.
    const last = writeGarmentImage(text, 'b', image('garments/b.png'));
    expect(JSON.parse(last).garments[1].image.file).toBe('garments/b.png');
  });

  it('copes with ids and strings holding escapes and braces', () => {
    const text = '{ "garments": [ { "id": "x\\"}", "note": "{[,]}" , "color": "#1" } ] }';
    const next = writeGarmentImage(text, 'x"}', image('garments/x.png'));
    expect(JSON.parse(next).garments[0].note).toBe('{[,]}');
    expect(JSON.parse(next).garments[0].image.file).toBe('garments/x.png');
  });

  it('throws for an unknown garment or broken JSON', () => {
    expect(() => writeGarmentImage(SEED, 'nope', image('x'))).toThrow(/no garment with id "nope"/);
    expect(() => writeGarmentImage('{ "garments": [ { "id": "a" ', 'a', image('x'))).toThrow(/seed.json/);
  });
});

describe('formatImage for pants', () => {
  it('seedWrite writes pants landmarks in PANTS_LANDMARKS order', () => {
    const shuffled = Object.fromEntries([...PANTS_LANDMARKS].reverse().map((n, i) => [n, { x: i, y: i }]));
    const text = formatImage({ file: 'garments/j.png', licence: 'own', photographedSize: null, landmarks: shuffled }, '      ');
    expect(Object.keys(JSON.parse(text).landmarks)).toEqual([...PANTS_LANDMARKS]);
  });
});

describe('licenceForSave', () => {
  it("keeps the saved photo's licence, and starts a new photo local-only", () => {
    const saved = image('garments/a.png');
    expect(licenceForSave(saved, 'garments/a.png')).toBe('own');
    expect(licenceForSave({ ...saved, licence: 'brand-permission' }, 'garments/a.png')).toBe('brand-permission');
    expect(licenceForSave(saved, 'garments/b.png')).toBe('local-only');
    expect(licenceForSave(undefined, 'garments/a.png')).toBe('local-only');
  });
});
