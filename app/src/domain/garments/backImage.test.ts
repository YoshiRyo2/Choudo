import { describe, expect, it } from 'vitest';
import { categorySpec, photoLandmarkNames, topLandmarks } from './categories';
import { SEED_GARMENTS } from './garments';
import { PANTS_IMAGE, TEE_BACK_IMAGE } from './testFixtures';
import { PHOTO_LICENCES, TOP_BACK_LANDMARKS, TOP_LANDMARKS, type GarmentImage } from './types';
import { validateGarment, validateImage } from './validate';

const seed = (id: string) => SEED_GARMENTS.find((g) => g.id === id)!;
const tee = seed('knightweave-tee');
const hoodie = seed('gildan-18500');
const jeans = seed('corvo-slim-jean');
const jacket = seed('port-authority-j317');

describe('a back photo', () => {
  it('a tee back photo needs the 13 back points, neckBack in place of neckFront', () => {
    expect(TOP_BACK_LANDMARKS).toHaveLength(13);
    expect(TOP_BACK_LANDMARKS).toEqual(TOP_LANDMARKS.map((n) => (n === 'neckFront' ? 'neckBack' : n)));
    expect(validateImage(TEE_BACK_IMAGE, tee, 'back')).toEqual([]);
    const { neckBack, ...rest } = TEE_BACK_IMAGE.landmarks;
    const asFront: GarmentImage = { ...TEE_BACK_IMAGE, landmarks: { ...rest, neckFront: neckBack } };
    const problems = validateImage(asFront, tee, 'back');
    expect(problems.join('\n')).toMatch(/neckBack/);
  });

  it('names a front-only point given to a back photo', () => {
    const both: GarmentImage = { ...TEE_BACK_IMAGE, landmarks: { ...TEE_BACK_IMAGE.landmarks, neckFront: { x: 500, y: 120 } } };
    expect(validateImage(both, tee, 'back')).toContain("neckFront isn't a landmark for a tee");
  });

  it('a hoodie back photo takes no hoodTop', () => {
    const hooded: GarmentImage = { ...TEE_BACK_IMAGE, landmarks: { ...TEE_BACK_IMAGE.landmarks, hoodTop: { x: 500, y: 10 } } };
    expect(validateImage(hooded, hoodie, 'back')).toContain("hoodTop isn't a landmark for a hoodie");
    expect(validateImage(TEE_BACK_IMAGE, hoodie, 'back')).toEqual([]);
  });

  it('checks the back neckline sits between and below the collar points', () => {
    const high: GarmentImage = { ...TEE_BACK_IMAGE, landmarks: { ...TEE_BACK_IMAGE.landmarks, neckBack: { x: 500, y: 40 } } };
    expect(validateImage(high, tee, 'back')).toContain('neckBack must sit between the collar points and below them');
  });

  it('pants back photos use the 14 pants points', () => {
    expect(validateImage(PANTS_IMAGE, jeans, 'back')).toEqual([]);
    expect(photoLandmarkNames(categorySpec(jeans), 'back')).toEqual(categorySpec(jeans).landmarks);
  });

  it('a jacket takes no back photo', () => {
    expect(photoLandmarkNames(categorySpec(jacket), 'back')).toBeNull();
    expect(validateImage(TEE_BACK_IMAGE, jacket, 'back')).toContain('photo textures are only supported for tops and pants');
  });

  it('a back photo needs a known licence', () => {
    const bad = { ...TEE_BACK_IMAGE, licence: 'free' } as unknown as GarmentImage;
    expect(validateImage(bad, tee, 'back')).toContain(`licence must be one of ${PHOTO_LICENCES.join(', ')}`);
  });

  it('garment problems name the back photo', () => {
    expect(validateGarment({ ...tee, backImage: TEE_BACK_IMAGE })).toEqual([]);
    const problems = validateGarment({ ...tee, backImage: { ...TEE_BACK_IMAGE, landmarks: {} } });
    expect(problems).toContainEqual(expect.stringMatching(/^backImage: landmarks need/));
  });

  it('topLandmarks reads a back photo with neckBack as the centre neckline', () => {
    expect(topLandmarks(TEE_BACK_IMAGE, 'back')!.neckFront).toEqual(TEE_BACK_IMAGE.landmarks.neckBack);
    expect(topLandmarks(TEE_BACK_IMAGE)).toBeNull();
  });
});
