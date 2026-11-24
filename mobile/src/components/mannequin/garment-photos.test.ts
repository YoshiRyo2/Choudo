import { GARMENTS, type GarmentImage } from '@choudo/core/domain/garments';

import { GARMENT_PHOTOS, photoSource } from './garment-photos';

const images: GarmentImage[] = GARMENTS.flatMap((g) => [g.image, g.backImage].filter((i): i is GarmentImage => Boolean(i)));
const SHIPPABLE = ['own', 'brand-permission', 'affiliate-unaltered'];

test('only photos whose licence allows it are bundled', () => {
  for (const file of Object.keys(GARMENT_PHOTOS)) {
    const image = images.find((i) => i.file === file);
    expect(image).toBeDefined();
    expect(image!.licence).not.toBe('local-only');
  }
});

test('every shippable photo in the seed is bundled', () => {
  const shippable = images.filter((i) => SHIPPABLE.includes(i.licence)).map((i) => i.file);
  expect(shippable.length).toBeGreaterThan(0);
  for (const file of shippable) expect(Object.keys(GARMENT_PHOTOS)).toContain(file);
});

test('the local-only photos (the navy graphic tee, Gildan 5000) are not bundled', () => {
  const keys = Object.keys(GARMENT_PHOTOS);
  expect(keys.some((k) => k.includes('ryo-navy-graphic-tee'))).toBe(false);
  expect(keys.some((k) => k.includes('gildan-5000'))).toBe(false);
});

test('keys are sorted, so the generated file is stable', () => {
  const keys = Object.keys(GARMENT_PHOTOS);
  expect(keys).toEqual([...keys].sort());
});

test('photoSource: null for a file that is not bundled', () => {
  expect(photoSource('garments/nope.png')).toBeNull();
  expect(photoSource('garments/gildan-5000-front.png')).toBeNull();
});

test('photoSource: the module and its pixel size for a bundled photo', () => {
  const src = photoSource('garments/ryo-black-henley-front.png');
  expect(src).not.toBeNull();
  expect(src!.module).toBe(GARMENT_PHOTOS['garments/ryo-black-henley-front.png']);
  expect(src!.width).toBeGreaterThan(0);
  expect(src!.height).toBeGreaterThan(0);
});
