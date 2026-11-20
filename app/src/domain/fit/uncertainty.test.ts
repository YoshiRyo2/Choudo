import { describe, expect, it } from 'vitest';
import { BODY_MEASUREMENT_KEYS } from '../body';
import { ESTIMATED_BODY_SD_CM } from './uncertainty';

describe('ESTIMATED_BODY_SD_CM', () => {
  it('every body key has an estimated spread for both body types', () => {
    for (const bodyType of ['womens', 'mens'] as const) {
      for (const key of BODY_MEASUREMENT_KEYS) expect(ESTIMATED_BODY_SD_CM[bodyType][key]).toBeGreaterThan(0);
    }
  });
});
