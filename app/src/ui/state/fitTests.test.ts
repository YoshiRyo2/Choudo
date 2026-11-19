import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { FIT_TEST_COLUMNS, preferenceSpec, readFitTestCsv, sampleFit } from '../../domain/fit';
import { findGarment } from '../../domain/garments';
import { anchorText, csvField, csvFileName, fitTestsCsv, makeFitTest, predictionFor } from './fitTests';
import { isFitTestList } from './stored';

const body = { heightCm: 178, weightKg: 75, bodyType: 'mens' } as const;
const model = estimateBody(body);
const gildan = findGarment('gildan-5000')!;

function predict(anchor: Parameters<typeof preferenceSpec>[0] = null) {
  const preference = preferenceSpec(anchor, null);
  return predictionFor({ body, model, garment: gildan, size: 'M', preference, anchor, odds: sampleFit(model, gildan, preference) });
}

describe('predictionFor', () => {
  it('freezes the body, preference, recommendation and chances for one size', () => {
    const p = predict();
    expect(p.chestSource).toBe('estimated');
    expect(p.preferenceSource).toBe('default');
    expect(p.preferredChestEaseCm).toBe(5);
    expect(p.preferredLengthDiffCm).toBeNull();
    expect(p.recommendedSize).toBe('M');
    expect(p.chestLabel).toBe('relaxed');
    expect(p.chest.under + p.chest.right + p.chest.over).toBeCloseTo(1);
    expect(p.likes).toBeGreaterThan(0);
  });

  it('records the anchor', () => {
    const p = predict({ kind: 'measured', chestFlatCm: 53, lengthCm: 74 });
    expect(p.anchor).toBe('measured 53x74 cm');
    expect(p.preferredChestEaseCm).toBeCloseTo(106 - model.measurements.chestCm);
    expect(p.preferredLengthDiffCm).toBeCloseTo(74 - model.measurements.torsoLengthCm);
  });
});

describe('fitTestsCsv', () => {
  const answers = { tester: ' T01 ', chest: 'just-right', length: 'too-short', keptSize: 'M' } as const;
  const later = makeFitTest('b', '2026-11-19T10:00:00Z', 'gildan-5000', 'L', { ...answers, keptSize: null }, predict());
  const earlier = makeFitTest('a', '2026-11-18T10:00:00Z', 'gildan-5000', 'M', answers, predict());

  it('makes records the stored guard accepts', () => {
    expect(isFitTestList([earlier, later])).toBe(true);
    expect(earlier.tester).toBe('T01');
  });

  it('writes the header, then rows oldest first, that read back by column', () => {
    const csv = fitTestsCsv([later, earlier]);
    expect(csv.split('\n')[0]).toBe(FIT_TEST_COLUMNS.join(','));
    const rows = readFitTestCsv(csv);
    expect(rows.map((r) => r.size)).toEqual(['M', 'L']);
    expect(rows[0]).toMatchObject({
      tester: 'T01',
      actual_chest: 'just-right',
      actual_length: 'too-short',
      kept_size: 'M',
      recommended_size: 'M',
      preference_source: 'default',
      chest_source: 'estimated',
      preferred_length_diff_cm: '',
    });
    expect(rows[1]?.kept_size).toBe('none');
    expect(Number(rows[0]?.p_chest_just_right)).toBeCloseTo(earlier.prediction.chest.right, 3);
  });

  it('quotes fields that need it', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a, "b"')).toBe('"a, ""b"""');
  });
});

describe('small helpers', () => {
  it('names the anchor and the file', () => {
    expect(anchorText({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' })).toBe('gildan-5000 M');
    expect(anchorText(null)).toBe('');
    expect(csvFileName(new Date(2026, 10, 8))).toBe('nimbus-fit-tests-2026-11-08.csv');
  });
});
