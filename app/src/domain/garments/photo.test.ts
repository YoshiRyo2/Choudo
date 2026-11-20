import { describe, expect, it } from 'vitest';
import { canWarp, localOnlyFiles } from './photo';
import type { GarmentImage, PhotoLicence } from './types';

const image = (licence: PhotoLicence, file = 'garments/a.png'): GarmentImage => ({
  file,
  licence,
  photographedSize: null,
  landmarks: {},
});

describe('canWarp', () => {
  it('warps own and brand-permission photos only', () => {
    expect(canWarp(image('own'))).toBe(true);
    expect(canWarp(image('brand-permission'))).toBe(true);
    expect(canWarp(image('affiliate-unaltered'))).toBe(false);
    expect(canWarp(image('local-only'))).toBe(false);
    expect(canWarp(undefined)).toBe(false);
  });
});

describe('localOnlyFiles', () => {
  it('lists each local-only file once', () => {
    const garments = [
      { image: image('local-only') },
      { image: image('local-only') },
      { image: image('own', 'garments/b.png') },
      {},
    ];
    expect(localOnlyFiles(garments)).toEqual(['garments/a.png']);
  });
});
