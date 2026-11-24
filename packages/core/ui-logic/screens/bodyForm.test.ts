import { describe, expect, it } from 'vitest';
import { braSizeProblemText, EMPTY_FORM, formToInput, inputToForm, parseNumber, switchUnits, type BodyForm } from './bodyForm';

const metric: BodyForm = { ...EMPTY_FORM, heightCm: '176', weight: '85' };

describe('parseNumber', () => {
  it('reads numbers, commas and blanks', () => {
    expect(parseNumber(' 82.5 ')).toBe(82.5);
    expect(parseNumber('82,5')).toBe(82.5);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
  });
});

describe('formToInput', () => {
  it('needs height and weight', () => {
    expect(formToInput({ ...metric, weight: '' })).toBeNull();
    expect(formToInput(metric)).toEqual({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
  });

  it('converts imperial to cm/kg', () => {
    const input = formToInput({
      ...EMPTY_FORM,
      units: 'imperial',
      heightFt: '5',
      heightIn: '10',
      weight: '180',
      overrides: { chest: '40', waist: '', hips: '', inseam: '' },
    });
    expect(input?.heightCm).toBeCloseTo(177.8);
    expect(input?.weightKg).toBeCloseTo(81.65, 1);
    expect(input?.overrides).toEqual({ chestCm: 101.6 });
  });

  it('only includes overrides that were filled in', () => {
    const input = formToInput({ ...metric, overrides: { chest: '', waist: '84', hips: '', inseam: '' } });
    expect(input?.overrides).toEqual({ waistCm: 84 });
  });
});

describe('round trips', () => {
  it('inputToForm -> formToInput keeps the numbers', () => {
    const input = { heightCm: 176, weightKg: 85, bodyType: 'womens' as const, overrides: { inseamCm: 80 } };
    expect(formToInput(inputToForm(input, 'metric'))).toEqual(input);
  });

  it('switching units keeps the body the same (within rounding)', () => {
    // Imperial height is shown to the nearest half inch, so allow up to ~1 cm drift.
    const back = switchUnits(switchUnits(metric, 'imperial'), 'metric');
    const input = formToInput(back)!;
    expect(Math.abs(input.heightCm - 176)).toBeLessThanOrEqual(1);
    expect(Math.abs(input.weightKg - 85)).toBeLessThanOrEqual(0.1);
  });
});

describe('bra size', () => {
  const womens: BodyForm = { ...metric, bodyType: 'womens' };

  it('adds a parsed bra size to a women’s body only', () => {
    expect(formToInput({ ...womens, braSize: '34dd', braSystem: 'uk' })?.overrides).toEqual({
      braSize: { band: 34, cup: 'DD', system: 'uk' },
    });
    expect(formToInput({ ...metric, braSize: '34DD' })?.overrides).toBeUndefined();
  });

  it('leaves out a bra size it can’t read, and says why', () => {
    const form = { ...womens, braSize: '34Q' };
    expect(formToInput(form)?.overrides).toBeUndefined();
    expect(braSizeProblemText(form)).toMatch(/^Q isn't a US cup size/);
    expect(braSizeProblemText({ ...womens, braSize: '' })).toBeUndefined();
    expect(braSizeProblemText({ ...metric, braSize: '34Q' })).toBeUndefined(); // ignored for men's
  });

  it('round-trips through inputToForm and keeps it when switching units', () => {
    const input = { heightCm: 165, weightKg: 60, bodyType: 'womens' as const, overrides: { braSize: { band: 32, cup: 'E', system: 'uk' as const } } };
    const form = inputToForm(input, 'metric');
    expect(form.braSize).toBe('32E');
    expect(form.braSystem).toBe('uk');
    expect(formToInput(form)).toEqual(input);
    expect(switchUnits({ ...womens, braSize: '36B' }, 'imperial').braSize).toBe('36B');
  });
});
