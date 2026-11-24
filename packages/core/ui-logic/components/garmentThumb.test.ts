import { describe, expect, it } from 'vitest';
import type { GarmentImage, PhotoLicence } from '../../domain/garments';
import { thumbPhotoSrc } from './garmentThumb';

const image = (licence: PhotoLicence): GarmentImage => ({
  file: 'garments/a-front.png',
  licence,
  photographedSize: null,
  landmarks: {},
});

describe('thumbPhotoSrc', () => {
  it('shows our own, brand-permission and affiliate photos', () => {
    expect(thumbPhotoSrc({ image: image('own') }, '/')).toBe('/garments/a-front.png');
    expect(thumbPhotoSrc({ image: image('brand-permission') }, '/')).toBe('/garments/a-front.png');
    expect(thumbPhotoSrc({ image: image('affiliate-unaltered') }, '/')).toBe('/garments/a-front.png');
  });

  it('never shows a local-only photo', () => {
    expect(thumbPhotoSrc({ image: image('local-only') }, '/')).toBeNull();
  });

  it('draws the flat icon when there is no photo', () => {
    expect(thumbPhotoSrc({}, '/')).toBeNull();
    expect(thumbPhotoSrc({ image: undefined }, '/')).toBeNull();
  });

  it('puts the file under the app base', () => {
    expect(thumbPhotoSrc({ image: image('own') }, '/Choudo/')).toBe('/Choudo/garments/a-front.png');
  });
});
