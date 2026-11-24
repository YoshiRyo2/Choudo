import { describe, expect, it } from 'vitest';
import { anchorToTeeForm, EMPTY_TEE_FORM, teeFormToAnchor } from './anchorForm';

describe('teeFormToAnchor', () => {
  it('reads cm as typed', () => {
    expect(teeFormToAnchor({ chest: '53', length: '74,5' }, 'metric')).toEqual({
      anchor: { kind: 'measured', chestFlatCm: 53, lengthCm: 74.5 },
      errors: {},
      missing: false,
    });
  });

  it('converts inches', () => {
    const r = teeFormToAnchor({ chest: '21', length: '29' }, 'imperial');
    expect(r.anchor?.chestFlatCm).toBeCloseTo(53.34);
    expect(r.anchor?.lengthCm).toBeCloseTo(73.66);
  });

  it('flags a full circumference typed as a flat width, in the user’s units', () => {
    expect(teeFormToAnchor({ chest: '106', length: '74' }, 'metric').errors.chest).toBe('Chest width should be 35–85 cm.');
    expect(teeFormToAnchor({ chest: '42', length: '29' }, 'imperial').errors.chest).toBe('Chest width should be 14–33 in.');
  });

  it('is missing (but not an error) while a field is blank', () => {
    expect(teeFormToAnchor({ chest: '53', length: '' }, 'metric')).toEqual({ anchor: null, errors: {}, missing: true });
  });
});

describe('anchorToTeeForm', () => {
  it('fills the form from a measured anchor, and leaves it blank otherwise', () => {
    expect(anchorToTeeForm({ kind: 'measured', chestFlatCm: 53.34, lengthCm: 73.66 }, 'imperial')).toEqual({ chest: '21', length: '29' });
    expect(anchorToTeeForm({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' }, 'metric')).toEqual(EMPTY_TEE_FORM);
    expect(anchorToTeeForm(null, 'metric')).toEqual(EMPTY_TEE_FORM);
  });
});
