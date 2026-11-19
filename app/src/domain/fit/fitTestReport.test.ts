import { describe, expect, it } from 'vitest';
import { FIT_TEST_COLUMNS, readFitTestCsv, type FitTestColumn } from './fitTestCsv';
import { buildFitTestReport, formatFitTestReport } from './fitTestReport';

type Row = Record<FitTestColumn, string>;

function row(patch: Partial<Row>): Row {
  const blank = Object.fromEntries(FIT_TEST_COLUMNS.map((c) => [c, ''])) as Row;
  return {
    ...blank,
    tester: 'T01',
    size: 'M',
    recommended_size: 'M',
    p_chest_too_tight: '0.2',
    p_chest_just_right: '0.7',
    p_chest_too_loose: '0.1',
    p_length_too_short: '0.1',
    p_length_just_right: '0.8',
    p_length_too_long: '0.1',
    actual_chest: 'just-right',
    actual_length: 'just-right',
    kept_size: 'M',
    ...patch,
  };
}

describe('buildFitTestReport', () => {
  const rows = [
    row({}), // both agree, size hit
    row({ tester: 'T02', actual_chest: 'too-tight', kept_size: 'L' }), // chest off by one, size miss
    row({ tester: 'T03', p_chest_too_tight: '0.6', p_chest_just_right: '0.3', actual_chest: 'too-loose', kept_size: 'none' }), // off by two
    row({ tester: 'T03', actual_length: '', recommended_size: '' }), // length skipped, no recommendation
  ];
  const r = buildFitTestReport(rows);

  it('counts rows and testers', () => {
    expect(r.rows).toBe(4);
    expect(r.testers).toBe(3);
  });

  it('label and within-one agreement per zone', () => {
    expect(r.agreement.chest).toEqual({ total: 4, agree: 2, withinOne: 3 });
    expect(r.agreement.length).toEqual({ total: 3, agree: 3, withinOne: 3 });
    expect(r.skipped).toEqual({ chest: [], length: [4] });
  });

  it('size hit rate leaves out "none" and rows without a recommendation', () => {
    expect(r.sizeHits).toEqual({ hits: 1, total: 2 });
  });

  it('calibration pools every predicted chance into 20% bins', () => {
    const total = r.calibration.reduce((n, b) => n + b.count, 0);
    expect(total).toBe((4 + 3) * 3);
    const top = r.calibration[3]!; // 60–80%: 0.7 ×3 (chest rows 1,2,4) + 0.6 (row 3 chest)
    expect(top.count).toBe(4);
    expect(top.meanPredicted).toBeCloseTo((0.7 * 3 + 0.6) / 4);
    expect(top.actualRate).toBeCloseTo(2 / 4); // rows 1 and 4 said just right; 2 too tight, 3 too loose
    const last = r.calibration[4]!; // 80–100%: the three 0.8 length chances, all just right
    expect(last).toMatchObject({ count: 3, actualRate: 1 });
    expect(last.meanPredicted).toBeCloseTo(0.8);
  });

  it('an empty bin has no rates', () => {
    expect(buildFitTestReport([row({})]).calibration[2]).toMatchObject({ count: 0, meanPredicted: null, actualRate: null });
  });
});

describe('formatFitTestReport', () => {
  it('prints every section', () => {
    const text = formatFitTestReport(buildFitTestReport([row({}), row({ tester: 'T02', actual_chest: 'too-tight', kept_size: 'L' })]));
    expect(text).toContain('2 results from 2 testers');
    expect(text).toMatch(/Label agreement[\s\S]*chest\s+50%\s+\(1 of 2\)/);
    expect(text).toMatch(/Within-one agreement[\s\S]*chest\s+100%/);
    expect(text).toMatch(/Size hit rate[\s\S]*50%\s+\(1 of 2/);
    expect(text).toContain('Calibration');
  });

  it('says what to do when there are no results', () => {
    expect(formatFitTestReport(buildFitTestReport([]))).toContain('No results yet');
  });

  it('reads the app’s own CSV', () => {
    const header = FIT_TEST_COLUMNS.join(',');
    const values = row({});
    const csv = `${header}\n${FIT_TEST_COLUMNS.map((c) => values[c]).join(',')}\n`;
    expect(buildFitTestReport(readFitTestCsv(csv)).agreement.chest.agree).toBe(1);
  });
});
