/**
 * How well the app's predictions match the 10-person fit test
 * (`npm run fit:report`, reading data/fit_tests.csv). Pure: rows in, numbers
 * and text out.
 *
 *  - Label agreement: the app's likeliest answer (too tight / just right / too
 *    loose; too short / just right / too long) is the tester's answer.
 *  - Within-one agreement: off by at most one step (only "too tight" vs "too loose" misses).
 *  - Size hit rate: the recommended size is the one the tester would keep
 *    (rows where they'd keep none, or we recommended none, are left out).
 *  - Calibration: every predicted chance (3 per zone per row, chest and length
 *    pooled) is put in a 20%-wide bin; in each bin, the average predicted chance
 *    should match how often that answer actually came up.
 */

import type { FitTestColumn } from './fitTestCsv';

type Row = Record<FitTestColumn, string>;

export const CALIBRATION_BINS = 5;

const ZONES = {
  chest: {
    answers: ['too-tight', 'just-right', 'too-loose'],
    p: ['p_chest_too_tight', 'p_chest_just_right', 'p_chest_too_loose'],
    actual: 'actual_chest',
  },
  length: {
    answers: ['too-short', 'just-right', 'too-long'],
    p: ['p_length_too_short', 'p_length_just_right', 'p_length_too_long'],
    actual: 'actual_length',
  },
} as const satisfies Record<string, { answers: readonly string[]; p: readonly FitTestColumn[]; actual: FitTestColumn }>;

export type ReportZone = keyof typeof ZONES;

export interface Agreement {
  /** Rows with a valid answer and predicted chances. */
  total: number;
  agree: number;
  withinOne: number;
}

export interface CalibrationBin {
  from: number;
  to: number;
  /** Predicted chances in this bin. */
  count: number;
  /** null when the bin is empty. */
  meanPredicted: number | null;
  actualRate: number | null;
}

export interface FitTestReport {
  rows: number;
  testers: number;
  agreement: Record<ReportZone, Agreement>;
  sizeHits: { hits: number; total: number };
  calibration: CalibrationBin[];
  /** Rows (1-based, after the header) skipped for a missing or unknown answer, per zone. */
  skipped: Record<ReportZone, number[]>;
}

/** The predicted chances for one zone, or null if any is missing or not a number. */
function chancesOf(row: Row, zone: ReportZone): number[] | null {
  const ps = ZONES[zone].p.map((c) => (row[c].trim() === '' ? NaN : Number(row[c])));
  return ps.every((p) => Number.isFinite(p)) ? ps : null;
}

/** Index of the largest value; the first one on a tie. */
const argmax = (xs: number[]) => xs.reduce((best, x, i) => (x > xs[best]! ? i : best), 0);

export function buildFitTestReport(rows: readonly Row[]): FitTestReport {
  const agreement: Record<ReportZone, Agreement> = {
    chest: { total: 0, agree: 0, withinOne: 0 },
    length: { total: 0, agree: 0, withinOne: 0 },
  };
  const skipped: Record<ReportZone, number[]> = { chest: [], length: [] };
  const bins = Array.from({ length: CALIBRATION_BINS }, () => ({ sumP: 0, hits: 0, count: 0 }));
  const sizeHits = { hits: 0, total: 0 };

  rows.forEach((row, i) => {
    for (const zone of Object.keys(ZONES) as ReportZone[]) {
      const spec = ZONES[zone];
      const actual = (spec.answers as readonly string[]).indexOf(row[spec.actual].trim());
      const ps = chancesOf(row, zone);
      if (actual === -1 || ps === null) {
        skipped[zone].push(i + 1);
        continue;
      }
      const predicted = argmax(ps);
      const a = agreement[zone];
      a.total += 1;
      if (predicted === actual) a.agree += 1;
      if (Math.abs(predicted - actual) <= 1) a.withinOne += 1;
      ps.forEach((p, k) => {
        const bin = bins[Math.min(CALIBRATION_BINS - 1, Math.floor(p * CALIBRATION_BINS))]!;
        bin.sumP += p;
        bin.count += 1;
        if (k === actual) bin.hits += 1;
      });
    }
    const kept = row.kept_size.trim();
    const recommended = row.recommended_size.trim();
    if (kept !== '' && kept !== 'none' && recommended !== '') {
      sizeHits.total += 1;
      if (kept === recommended) sizeHits.hits += 1;
    }
  });

  return {
    rows: rows.length,
    testers: new Set(rows.map((r) => r.tester.trim()).filter((t) => t !== '')).size,
    agreement,
    sizeHits,
    calibration: bins.map((b, i) => ({
      from: i / CALIBRATION_BINS,
      to: (i + 1) / CALIBRATION_BINS,
      count: b.count,
      meanPredicted: b.count > 0 ? b.sumP / b.count : null,
      actualRate: b.count > 0 ? b.hits / b.count : null,
    })),
    skipped,
  };
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((100 * n) / d)}%`);
const pctOf = (x: number | null) => (x === null ? '—' : `${Math.round(100 * x)}%`);

export function formatFitTestReport(r: FitTestReport): string {
  const lines = [`Fit test report — ${r.rows} ${r.rows === 1 ? 'result' : 'results'} from ${r.testers} ${r.testers === 1 ? 'tester' : 'testers'}`, ''];
  if (r.rows === 0) {
    lines.push('No results yet. Record some in Test mode, download the CSV and add its rows to data/fit_tests.csv.');
    return lines.join('\n');
  }
  lines.push('Label agreement (app’s likeliest answer = tester’s answer)');
  for (const zone of ['chest', 'length'] as const) {
    const a = r.agreement[zone];
    lines.push(`  ${zone.padEnd(7)} ${pct(a.agree, a.total).padStart(4)}  (${a.agree} of ${a.total})`);
  }
  lines.push('', 'Within-one agreement (off by at most one step)');
  for (const zone of ['chest', 'length'] as const) {
    const a = r.agreement[zone];
    lines.push(`  ${zone.padEnd(7)} ${pct(a.withinOne, a.total).padStart(4)}  (${a.withinOne} of ${a.total})`);
  }
  lines.push(
    '',
    'Size hit rate (recommended = size they’d keep)',
    `  ${pct(r.sizeHits.hits, r.sizeHits.total).padStart(4)}  (${r.sizeHits.hits} of ${r.sizeHits.total}; "none" left out)`,
    '',
    'Calibration (chest and length pooled: predicted chance vs how often it happened)',
    '  bin        n  predicted  actual',
  );
  for (const b of r.calibration) {
    const bin = `${Math.round(b.from * 100)}–${Math.round(b.to * 100)}%`;
    lines.push(`  ${bin.padEnd(8)} ${String(b.count).padStart(3)}  ${pctOf(b.meanPredicted).padStart(9)}  ${pctOf(b.actualRate).padStart(6)}`);
  }
  for (const zone of ['chest', 'length'] as const) {
    if (r.skipped[zone].length > 0) lines.push('', `Skipped for ${zone} (missing or unknown answer): rows ${r.skipped[zone].join(', ')}`);
  }
  return lines.join('\n');
}
