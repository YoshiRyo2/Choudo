import { describe, expect, it } from 'vitest';
import type { GarmentImage, PhotoLicence } from '../../../domain/garments';
import { viewPhoto } from './view';

const photo = (licence: PhotoLicence, file = 'garments/a-front.png'): GarmentImage => ({ file, licence, photographedSize: null, landmarks: {} });

describe('viewPhoto', () => {
  it('the back never shows the front photo', () => {
    expect(viewPhoto({ image: photo('own') }, 'back', 'licensed')).toBeUndefined();
    expect(viewPhoto({ image: photo('own') }, 'back', 'all')).toBeUndefined();
  });

  it('a back photo is warped under the same licence rules', () => {
    const own = photo('own', 'garments/a-back.png');
    expect(viewPhoto({ image: photo('own'), backImage: own }, 'back', 'licensed')).toBe(own);
    expect(viewPhoto({ backImage: photo('brand-permission') }, 'back', 'licensed')).toBeDefined();
    for (const licence of ['local-only', 'affiliate-unaltered'] as const) {
      const back = photo(licence, 'garments/a-back.png');
      expect(viewPhoto({ backImage: back }, 'back', 'licensed')).toBeUndefined();
      expect(viewPhoto({ backImage: back }, 'back', 'all')).toBe(back);
    }
  });

  it('the front is as before', () => {
    const local = photo('local-only');
    expect(viewPhoto({ image: local, backImage: photo('own', 'b.png') }, 'front', 'licensed')).toBeUndefined();
    expect(viewPhoto({ image: local }, 'front', 'all')).toBe(local);
    expect(viewPhoto({ image: photo('own') }, 'front', 'licensed')).toEqual(photo('own'));
    expect(viewPhoto({}, 'front', 'all')).toBeUndefined();
  });
});
