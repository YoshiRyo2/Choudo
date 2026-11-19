import { describe, expect, it } from 'vitest';
import { convertValue, normalizeMeasurements, normalizeSize, readValue } from './normalize';

describe('readValue', () => {
  it('treats a plain number as copied from the chart', () => {
    expect(readValue(20)).toEqual({ value: 20, origin: 'chart' });
  });

  it('keeps an explicit origin', () => {
    const v = { value: 25, origin: 'estimated' as const, how: 'M plus the usual step' };
    expect(readValue(v)).toBe(v);
  });
});

describe('convertValue', () => {
  it('doubles flat girths, then converts inches, and says so', () => {
    const r = convertValue('chest', 20, { unit: 'in', girth: 'flat' });
    expect(r.cm).toBeCloseTo(101.6);
    expect(r.conversions).toEqual(['flat width doubled to a full circumference', 'inches to cm']);
  });

  it('never doubles a length, even on a flat chart', () => {
    const r = convertValue('length', 29, { unit: 'in', girth: 'flat' });
    expect(r.cm).toBeCloseTo(73.66);
    expect(r.conversions).toEqual(['inches to cm']);
  });

  it('notes that an unknown-method girth is used as printed', () => {
    const r = convertValue('chest', 100, { unit: 'cm', girth: 'unknown' });
    expect(r.cm).toBe(100);
    expect(r.conversions[0]).toMatch(/not scored/);
  });

  it('records no conversions for cm circumferences', () => {
    expect(convertValue('waist', 80, { unit: 'cm', girth: 'circumference' })).toEqual({ cm: 80, conversions: [] });
  });
});

describe('normalizeSize', () => {
  const chart = { unit: 'in' as const, girth: 'flat' as const };

  it('keeps origin, printed value and conversions for every number', () => {
    const s = normalizeSize(
      {
        label: 'M',
        measurements: {
          chest: 20,
          length: 29,
          sleeve: { value: 8.5, origin: 'estimated', how: 'from the S and L rows' },
        },
      },
      chart,
    );
    expect(s.measurements.chest).toBeCloseTo(101.6);
    expect(s.measurements.sleeve).toBeCloseTo(21.59);
    expect(s.provenance.chest).toEqual({
      origin: 'chart',
      printed: 20,
      unit: 'in',
      conversions: ['flat width doubled to a full circumference', 'inches to cm'],
    });
    expect(s.provenance.sleeve).toMatchObject({ origin: 'estimated', printed: 8.5, how: 'from the S and L rows' });
    expect(s.provenance.waist).toBeUndefined();
  });
});

describe('normalizeMeasurements', () => {
  it('converts plain numbers the same way', () => {
    const m = normalizeMeasurements({ chest: 20, length: 29 }, chart());
    expect(m.chest).toBeCloseTo(101.6);
    expect(m.length).toBeCloseTo(73.66);
  });
});

function chart() {
  return { unit: 'in' as const, girth: 'flat' as const };
}
