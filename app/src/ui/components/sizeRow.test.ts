import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { fitAllSizes, preferenceSpec, sampleFit } from '../../domain/fit';
import { findGarment } from '../../domain/garments';
import { verdictLine } from '../fitText';
import { centredScrollLeft, chipTone } from './sizeRow';

// A 300 px wide row that scrolls to 600 px; chips are measured from the row's content start.
const row = { clientWidth: 300, scrollWidth: 600 };

describe('centredScrollLeft', () => {
  it('centres a chip in the middle of the row', () => {
    expect(centredScrollLeft(row, { offsetLeft: 280, width: 60 })).toBe(160); // 280 + 30 − 150
  });

  it('never scrolls before the start', () => {
    expect(centredScrollLeft(row, { offsetLeft: 20, width: 60 })).toBe(0);
  });

  it('never scrolls past the end', () => {
    expect(centredScrollLeft(row, { offsetLeft: 560, width: 40 })).toBe(300);
  });

  it('stays at 0 when everything fits', () => {
    expect(centredScrollLeft({ clientWidth: 300, scrollWidth: 300 }, { offsetLeft: 200, width: 60 })).toBe(0);
  });
});

describe('chipTone', () => {
  // The two cases that disagreed before: the chip's dot read the chart-only fit.overall.
  const cases = [{ body: { heightCm: 178, weightKg: 75, bodyType: 'mens' as const }, id: 'ryo-cream-boxy-tee', size: 'Mine' }];

  it.each(cases)('gives the selected size the verdict line’s colour ($id)', ({ body, id, size }) => {
    const model = estimateBody(body);
    const garment = findGarment(id)!;
    const odds = sampleFit(model, garment, preferenceSpec(null, null));
    const fit = fitAllSizes(model, garment).find((f) => f.sizeLabel === size)!;
    const line = verdictLine(odds, size, garment);
    expect(line.headline).not.toMatch(/^Could go either way/);
    expect(chipTone(fit, odds)).toBe(line.tone);
    expect(fit.overall).not.toBe(line.tone); // the old dot
  });

  it('falls back to the chart-only fit when there are no odds', () => {
    const model = estimateBody(cases[0]!.body);
    const fit = fitAllSizes(model, findGarment('ryo-cream-boxy-tee')!)[0]!;
    expect(chipTone(fit)).toBe(fit.overall);
  });
});
