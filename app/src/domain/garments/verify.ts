/**
 * Stage 5 of the pipeline: checking a garment's numbers before we trust them.
 *
 * checkGarment(seed) runs every check on one seed row and sorts what it finds
 * into errors (the garment is left out of the catalogue) and warnings (a person
 * should look). It also lists zones that can't be scored and, if someone
 * measured a real garment, how it compares to the chart. Pure; no seed import.
 */

import { inToCm } from '../units';
import { GIRTH_KEYS, isGirthKey, MEASUREMENT_KEYS, normalizeMeasurements, normalizeSize, readValue } from './normalize';
import type { GarmentSize, MeasurementKey, SeedGarment } from './types';
import { REQUIRED, validateGarment } from './validate';
import {
  AUDIT_TOLERANCE_CM,
  BOTTOM_RANGES,
  BOTTOM_WAIST_EASE,
  CHEST_EASE_BY_INTENT,
  GIRTH_METHOD_LIMITS,
  GRADING_MIN_EXCESS_CM,
  GRADING_RATIO,
  referenceChestCm,
  TOP_LENGTH_RANGES,
  TOP_RANGES,
  type Range,
} from './verifyRules';

export type CheckName = 'structure' | 'monotonic' | 'grading' | 'range' | 'girth-method' | 'audit';

export interface CheckIssue {
  check: CheckName;
  message: string;
}

/** A zone the fit engine won't score, and why. */
export interface UnscorableZone {
  key: MeasurementKey;
  reason: string;
  /** A measurement the category can't do without (chest + length for tops, waist + inseam for bottoms). */
  required: boolean;
}

export interface AuditDiff {
  key: MeasurementKey;
  /** Both cm, full circumferences. null when the two can't be compared (see note). */
  chartCm: number | null;
  auditCm: number;
  /** audit − chart. Negative = the real garment is smaller than the chart says. */
  diffCm: number | null;
  note?: string;
}

export interface AuditResult {
  size: string;
  measuredOn: string;
  afterWash: boolean;
  diffs: AuditDiff[];
}

export interface GarmentCheck {
  garmentId: string;
  errors: CheckIssue[];
  warnings: CheckIssue[];
  unscorable: UnscorableZone[];
  audit: AuditResult | null;
}

const EPS = 1e-6;
const cm = (v: number) => `${v.toFixed(1)} cm`;

/** Every check on one seed garment. */
export function checkGarment(g: SeedGarment): GarmentCheck {
  const result: GarmentCheck = { garmentId: g.id, errors: [], warnings: [], unscorable: [], audit: null };
  const structural = validateGarment(g);
  if (structural.length > 0) {
    // Malformed rows can't be measured against anything; fix these first.
    result.errors = structural.map((message) => ({ check: 'structure', message }));
    return result;
  }

  const sizes = g.sizes.map((s) => normalizeSize(s, g.chart));
  const error = (check: CheckName, message: string) => result.errors.push({ check, message });
  const warn = (check: CheckName, message: string) => result.warnings.push({ check, message });

  for (const m of checkGirthMethod(g)) (m.severity === 'error' ? error : warn)('girth-method', m.message);
  for (const key of MEASUREMENT_KEYS) {
    for (const series of seriesFor(sizes, key)) {
      for (const m of checkMonotonic(key, series)) error('monotonic', m);
      for (const m of checkGrading(key, series)) warn('grading', m);
    }
  }
  for (const m of checkRanges(g, sizes)) warn('range', m);
  result.unscorable = unscorableZones(g);
  if (g.audit) {
    result.audit = compareAudit(g, sizes);
    for (const d of result.audit.diffs) {
      if (d.diffCm === null) continue;
      const tolerance = isGirthKey(d.key) ? AUDIT_TOLERANCE_CM.girth : AUDIT_TOLERANCE_CM.length;
      if (Math.abs(d.diffCm) > tolerance) {
        const way = d.diffCm < 0 ? 'smaller' : 'bigger';
        warn('audit', `audit: ${d.key} in ${result.audit.size} is ${cm(Math.abs(d.diffCm))} ${way} than the chart says`);
      }
    }
  }
  return result;
}

// ---------- series: which sizes to compare with which ----------

export interface Point {
  label: string;
  cm: number;
}

const WAIST_BY_LENGTH = /^(\d+)\s*x\s*(\d+)$/i;

/**
 * The runs of sizes along which `key` should grow. Normally one run, in chart
 * order. Pants sized waist × length ("32x30") grow two ways: inseam grows with
 * the length within one waist, and everything else grows with the waist.
 */
export function seriesFor(sizes: GarmentSize[], key: MeasurementKey): Point[][] {
  const withKey = sizes.filter((s) => s.measurements[key] !== undefined);
  const point = (s: GarmentSize): Point => ({ label: s.label, cm: s.measurements[key]! });
  const parsed = withKey.map((s) => ({ s, m: WAIST_BY_LENGTH.exec(s.label) }));
  if (withKey.length === 0 || parsed.some((p) => p.m === null)) return withKey.length > 1 ? [withKey.map(point)] : [];

  const dims = parsed.map(({ s, m }) => ({ s, waist: Number(m![1]), length: Number(m![2]) }));
  const runs: Point[][] = [];
  if (key === 'inseam') {
    for (const waist of [...new Set(dims.map((d) => d.waist))].sort((a, b) => a - b)) {
      const run = dims.filter((d) => d.waist === waist).sort((a, b) => a.length - b.length);
      if (run.length > 1) runs.push(run.map((d) => point(d.s)));
    }
    return runs;
  }
  // One point per waist (its shortest length), smallest waist first.
  const byWaist = new Map<number, GarmentSize>();
  for (const d of [...dims].sort((a, b) => a.waist - b.waist || a.length - b.length)) {
    if (!byWaist.has(d.waist)) byWaist.set(d.waist, d.s);
  }
  const run = [...byWaist.values()].map(point);
  return run.length > 1 ? [run] : [];
}

// ---------- the checks ----------

/** Each size must be at least as big as the one before (equal is fine: inseams often stay put). */
export function checkMonotonic(key: MeasurementKey, run: Point[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < run.length; i++) {
    const [a, b] = [run[i - 1]!, run[i]!];
    if (b.cm < a.cm - EPS) out.push(`${key} drops from ${a.label} (${cm(a.cm)}) to ${b.label} (${cm(b.cm)})`);
  }
  return out;
}

/** A step much bigger than the steps either side of it: often a typo in the chart. */
export function checkGrading(key: MeasurementKey, run: Point[]): string[] {
  const steps = run.slice(1).map((p, i) => p.cm - run[i]!.cm);
  const out: string[] = [];
  steps.forEach((step, i) => {
    const neighbours = [steps[i - 1], steps[i + 1]].filter((n): n is number => n !== undefined && n > EPS);
    if (neighbours.length === 0) return;
    const biggest = Math.max(...neighbours);
    if (neighbours.every((n) => step > GRADING_RATIO * n) && step - biggest >= GRADING_MIN_EXCESS_CM) {
      out.push(
        `${key} jumps ${cm(step)} from ${run[i]!.label} to ${run[i + 1]!.label}, ` +
          `more than ${GRADING_RATIO}× the step next to it (${cm(biggest)})`,
      );
    }
  });
  return out;
}

/**
 * Printed girths that look like the other method. A known method that looks wrong
 * is an error (we'd be off by a factor of two); an unknown one only gets a hint.
 */
export function checkGirthMethod(g: SeedGarment): { severity: 'error' | 'warning'; message: string }[] {
  const out: { severity: 'error' | 'warning'; message: string }[] = [];
  const { girth, unit } = g.chart;
  for (const key of GIRTH_KEYS) {
    const printed = g.sizes
      .map((s) => s.measurements[key])
      .filter((v) => v !== undefined)
      .map((v) => (unit === 'in' ? inToCm(readValue(v).value) : readValue(v).value)); // no doubling
    if (printed.length === 0) continue;
    const { flatMax, circumferenceMin } = GIRTH_METHOD_LIMITS[key];
    const span = `${cm(Math.min(...printed))}–${cm(Math.max(...printed))} as printed`;
    const tooBigForFlat = printed.filter((v) => v > flatMax);
    const tooSmallForRound = printed.filter((v) => v < circumferenceMin);
    if (girth === 'flat' && tooBigForFlat.length > 0) {
      out.push({ severity: 'error', message: `${key} is marked flat, but ${span} looks like a full circumference` });
    } else if (girth === 'circumference' && tooSmallForRound.length > 0) {
      out.push({ severity: 'error', message: `${key} is marked circumference, but ${span} looks like a flat width` });
    } else if (girth === 'unknown') {
      const looks =
        tooBigForFlat.length === printed.length ? 'full circumferences' : tooSmallForRound.length === printed.length ? 'flat widths' : null;
      if (looks) {
        out.push({
          severity: 'warning',
          message: `${key} method is unknown; ${span} look like ${looks}. Confirm on the chart before setting chart.girth`,
        });
      }
    }
  }
  return out;
}

/** Numbers outside what a real garment of this type measures, and implausible ease for the fit intent. */
export function checkRanges(g: SeedGarment, sizes: GarmentSize[]): string[] {
  const out: string[] = [];
  const girthKnown = g.chart.girth !== 'unknown';
  const outside = (what: string, v: number, r: Range) => {
    if (v < r.min || v > r.max) out.push(`${what} is ${cm(v)}, outside ${r.min}–${r.max} cm`);
  };

  for (const s of sizes) {
    const m = s.measurements;
    const ranges = g.category === 'top' ? TOP_RANGES : BOTTOM_RANGES;
    for (const key of MEASUREMENT_KEYS) {
      const v = m[key];
      const r = ranges[key];
      if (v === undefined || r === undefined) continue;
      if (isGirthKey(key) && !girthKnown) continue;
      if (key === 'sleeve' && !(g.sleeve === 'long' && g.chart.sleeveDefinition === 'shoulder_to_cuff')) continue;
      outside(`${key} in ${s.label}`, v, r);
    }
    if (g.category === 'top' && m.length !== undefined && g.chart.lengthDefinition === 'hps') {
      const r = TOP_LENGTH_RANGES[g.type];
      if (r) outside(`length in ${s.label}`, m.length, r);
    }

    if (!girthKnown) continue;
    if (g.category === 'top' && g.sizing !== 'womens' && m.chest !== undefined) {
      const body = referenceChestCm(s.label);
      const r = CHEST_EASE_BY_INTENT[g.fitIntent];
      if (body !== null && (m.chest - body < r.min || m.chest - body > r.max)) {
        out.push(
          `chest ease in ${s.label} is ${cm(m.chest - body)} over a typical ${cm(body)} chest, ` +
            `outside ${r.min}–${r.max} cm for a ${g.fitIntent} fit`,
        );
      }
    }
    if (g.category === 'bottom' && m.waist !== undefined) {
      const labelWaist = /^(\d{2})(?:\s*x\s*\d+)?$/i.exec(s.label);
      if (labelWaist) {
        const nominal = Number(labelWaist[1]) * 2.54;
        const ease = m.waist - nominal;
        const r = BOTTOM_WAIST_EASE;
        if (ease < r.min || ease > r.max) {
          out.push(`waist in ${s.label} is ${cm(m.waist)}, ${cm(ease)} off the ${labelWaist[1]} in on the label`);
        }
      }
    }
  }
  return out;
}

/** Zones the fit engine will answer "unknown" for because a definition is missing. */
export function unscorableZones(g: SeedGarment): UnscorableZone[] {
  const present = new Set(g.sizes.flatMap((s) => Object.keys(s.measurements) as MeasurementKey[]));
  const required = new Set(REQUIRED[g.category]);
  const out: UnscorableZone[] = [];
  if (g.chart.girth === 'unknown') {
    for (const key of GIRTH_KEYS) {
      if (present.has(key)) out.push({ key, reason: 'chart doesn’t say flat or full circumference', required: required.has(key) });
    }
  }
  if (g.category === 'top' && present.has('length') && g.chart.lengthDefinition !== 'hps') {
    const reason =
      g.chart.lengthDefinition === 'center_back'
        ? 'length is measured from the back of the neck, not the shoulder'
        : 'chart doesn’t say where length is measured from';
    out.push({ key: 'length', reason, required: true });
  }
  // Only long sleeves are scored; short sleeves are a style choice.
  if (g.sleeve === 'long' && present.has('sleeve') && g.chart.sleeveDefinition !== 'shoulder_to_cuff') {
    out.push({ key: 'sleeve', reason: 'sleeve isn’t measured shoulder to cuff', required: false });
  }
  return out;
}

/** How a hand-measured garment compares to the chart, number by number. */
export function compareAudit(g: SeedGarment, sizes: GarmentSize[]): AuditResult {
  const audit = g.audit!;
  // Audits are measured laid flat, so their girths are flat widths.
  const measured = normalizeMeasurements(audit.measurements, { unit: audit.unit, girth: 'flat' });
  const size = sizes.find((s) => s.label === audit.measuredSize);
  const chart = size?.measurements ?? {};
  const diffs: AuditDiff[] = [];
  for (const key of MEASUREMENT_KEYS) {
    const auditCm = measured[key];
    if (auditCm === undefined) continue;
    const chartCm = chart[key];
    if (chartCm === undefined) {
      diffs.push({ key, chartCm: null, auditCm, diffCm: null, note: 'not on the chart' });
    } else if (isGirthKey(key) && g.chart.girth === 'unknown') {
      // Can't compare, but the audit is evidence for which method the chart uses.
      const printed = size?.provenance[key];
      diffs.push({
        key,
        chartCm: null,
        auditCm,
        diffCm: null,
        note: `chart method unknown; it prints ${printed?.printed} ${printed?.unit} for this size`,
      });
    } else {
      diffs.push({ key, chartCm, auditCm, diffCm: auditCm - chartCm });
    }
  }
  return { size: audit.measuredSize, measuredOn: audit.measuredOn, afterWash: audit.afterWash, diffs };
}
