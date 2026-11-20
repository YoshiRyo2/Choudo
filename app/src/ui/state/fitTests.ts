/**
 * Test mode: what the app predicted for a garment and size, next to how it
 * actually fit a tester, and the CSV that goes into data/fit_tests.csv.
 * `npm run fit:report` reads that CSV (see domain/fit/fitTestReport.ts).
 */

import type { BodyInput, BodyModel } from '../../domain/body';
import {
  garmentChestTarget,
  FIT_TEST_COLUMNS,
  fitGarment,
  resolvePreference,
  VERDICTS,
  type Anchor,
  type FitTestColumn,
  type GarmentFit,
  type GarmentOdds,
  type PreferenceSpec,
  type ZoneOdds,
} from '../../domain/fit';
import type { Garment } from '../../domain/garments';
import type { FitTestPrediction, FitTestRecord, GirthAnswer, LengthAnswer, ZoneChances } from './stored';

/** How an anchor reads in the CSV: "gildan-5000 M" or "measured 53x74 cm". */
export function anchorText(anchor: Anchor | null): string {
  if (!anchor) return '';
  if (anchor.kind === 'catalogue') return `${anchor.garmentId} ${anchor.size}`;
  return `measured ${anchor.chestFlatCm}x${anchor.lengthCm} cm`;
}

function chances(z: ZoneOdds | undefined): ZoneChances {
  return z ? { under: z.personal.under, right: z.personal.right, over: z.personal.over } : { under: 0, right: 0, over: 0 };
}

/** What the app says about this garment and size, frozen at the moment the tester answers. */
export function predictionFor(args: {
  body: BodyInput;
  model: BodyModel;
  garment: Garment;
  size: string;
  preference: PreferenceSpec;
  anchor: Anchor | null;
  odds: GarmentOdds;
}): FitTestPrediction {
  const { body, model, garment, size, preference, anchor, odds } = args;
  const sizeOdds = odds.sizes.find((s) => s.sizeLabel === size);
  if (!sizeOdds) throw new Error(`${garment.id} has no size "${size}"`);
  const fit = fitGarment(model, garment, size);
  const pref = resolvePreference(preference, model.measurements);
  const zoneFit = (zone: string) => fit.zones.find((z) => z.zone === zone);
  const labelOf = (zone: string) => zoneFit(zone)?.label ?? 'unknown';
  const oddsOf = (zone: string) => chances(sizeOdds.zones.find((z) => z.zone === zone));
  const verdict = VERDICTS.reduce((best, v) => (sizeOdds.verdicts[v] > sizeOdds.verdicts[best] ? v : best), VERDICTS[0]!);
  const top = garment.category === 'top';
  // A bottom's length question is about the inseam.
  const lengthZone = top ? 'length' : 'inseam';
  const prediction: FitTestPrediction = {
    category: top ? 'top' : 'bottom',
    body,
    chestCm: model.measurements.chestCm,
    chestSource: model.sources.chestCm,
    torsoLengthCm: model.measurements.torsoLengthCm,
    preferenceSource: preference.source,
    style: preference.style,
    anchor: preference.source === 'anchor' ? anchorText(anchor) : '',
    preferredChestEaseCm: top ? garmentChestTarget(pref, garment).easeCm : null,
    preferredLengthDiffCm: pref.lengthDiffCm,
    recommendedSize: odds.recommended,
    verdict,
    likes: sizeOdds.likes,
    chestLabel: labelOf('chest'),
    lengthLabel: labelOf(lengthZone),
    chest: oddsOf('chest'),
    length: oddsOf(lengthZone),
  };
  if (top) return prediction;
  return {
    ...prediction,
    inseamCm: model.measurements.inseamCm,
    waistCm: zoneFit('waist')?.bodyCm ?? model.measurements.waistCm,
    thighCm: model.measurements.thighCm,
    waistLabel: labelOf('waist'),
    thighLabel: labelOf('thigh'),
    waist: oddsOf('waist'),
    thigh: oddsOf('thigh'),
  };
}

export interface TesterAnswers {
  tester: string;
  /** Tops: the chest. null on a bottom. */
  chest: GirthAnswer | null;
  /** Bottoms: the waist, and the thigh when it was asked. */
  waist?: GirthAnswer;
  thigh?: GirthAnswer;
  /** A top's length or a bottom's inseam. */
  length: LengthAnswer;
  keptSize: string | null;
}

export function makeFitTest(id: string, at: string, garmentId: string, size: string, answers: TesterAnswers, prediction: FitTestPrediction): FitTestRecord {
  return { id, at, garmentId, size, category: prediction.category, ...answers, tester: answers.tester.trim(), prediction };
}

/** A Test-mode question: a girth, or the length (a top's length, a bottom's inseam). */
export type TestQuestion = 'chest' | 'waist' | 'thigh' | 'length';

/**
 * What Test mode asks about this garment and size: chest and length on a top;
 * waist, thigh and inseam on a bottom, leaving out a thigh the app couldn't score
 * (nothing to compare the answer with).
 */
export function testQuestions(fit: GarmentFit, garment: Pick<Garment, 'category'>): TestQuestion[] {
  if (garment.category === 'top') return ['chest', 'length'];
  const thigh = fit.zones.find((z) => z.zone === 'thigh');
  return thigh && thigh.label !== 'unknown' ? ['waist', 'thigh', 'length'] : ['waist', 'length'];
}

export interface PickedAnswers {
  chest: GirthAnswer | null;
  waist: GirthAnswer | null;
  thigh: GirthAnswer | null;
  length: LengthAnswer | null;
}

/** The tester's answers to save, or null while a question, the tester or the kept size is missing. */
export function answersFor(questions: TestQuestion[], picked: PickedAnswers, tester: string, keptSize: string | null | undefined): TesterAnswers | null {
  if (tester.trim() === '' || keptSize === undefined || picked.length === null) return null;
  if (questions.some((q) => picked[q] === null)) return null;
  const answers: TesterAnswers = { tester, chest: questions.includes('chest') ? picked.chest : null, length: picked.length, keptSize };
  if (questions.includes('waist') && picked.waist) answers.waist = picked.waist;
  if (questions.includes('thigh') && picked.thigh) answers.thigh = picked.thigh;
  return answers;
}

const cm = (v: number | null) => (v === null ? '' : v.toFixed(1));
const p = (v: number) => v.toFixed(3);

/** One CSV row's values, by column. */
export function fitTestRow(r: FitTestRecord): Record<FitTestColumn, string> {
  const x = r.prediction;
  const top = r.category === 'top';
  // Chances for a zone the row asked about, blank for one it didn't (so the report leaves it out).
  const pz = (z: ZoneChances | undefined, k: keyof ZoneChances, asked: boolean) => (asked && z ? p(z[k]) : '');
  const opt = (v: number | undefined) => (v === undefined ? '' : cm(v));
  return {
    tester: r.tester,
    recorded_at: r.at,
    garment_id: r.garmentId,
    size: r.size,
    height_cm: cm(x.body.heightCm),
    weight_kg: cm(x.body.weightKg),
    sizing: x.body.bodyType,
    chest_cm: cm(x.chestCm),
    chest_source: x.chestSource,
    torso_cm: cm(x.torsoLengthCm),
    preference_source: x.preferenceSource,
    style: x.style,
    anchor: x.anchor,
    preferred_chest_ease_cm: cm(x.preferredChestEaseCm),
    preferred_length_diff_cm: cm(x.preferredLengthDiffCm),
    recommended_size: x.recommendedSize ?? '',
    predicted_verdict: x.verdict,
    p_fits_how_you_like: p(x.likes),
    predicted_chest_label: top ? x.chestLabel : '',
    predicted_length_label: x.lengthLabel,
    p_chest_too_tight: pz(x.chest, 'under', top),
    p_chest_just_right: pz(x.chest, 'right', top),
    p_chest_too_loose: pz(x.chest, 'over', top),
    p_length_too_short: p(x.length.under),
    p_length_just_right: p(x.length.right),
    p_length_too_long: p(x.length.over),
    actual_chest: r.chest ?? '',
    actual_length: r.length,
    kept_size: r.keptSize ?? 'none',
    category: r.category,
    inseam_cm: opt(x.inseamCm),
    waist_cm: opt(x.waistCm),
    thigh_cm: opt(x.thighCm),
    predicted_waist_label: x.waistLabel ?? '',
    predicted_thigh_label: r.thigh ? (x.thighLabel ?? '') : '',
    p_waist_too_tight: pz(x.waist, 'under', !top),
    p_waist_just_right: pz(x.waist, 'right', !top),
    p_waist_too_loose: pz(x.waist, 'over', !top),
    p_thigh_too_tight: pz(x.thigh, 'under', r.thigh !== undefined),
    p_thigh_just_right: pz(x.thigh, 'right', r.thigh !== undefined),
    p_thigh_too_loose: pz(x.thigh, 'over', r.thigh !== undefined),
    actual_waist: r.waist ?? '',
    actual_thigh: r.thigh ?? '',
  };
}

/** Quote a CSV field if it needs it. */
export function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The whole CSV, header first, oldest result first. Lines end in \n. */
export function fitTestsCsv(records: readonly FitTestRecord[]): string {
  const lines = [FIT_TEST_COLUMNS.join(',')];
  for (const r of [...records].sort((a, b) => a.at.localeCompare(b.at))) {
    const row = fitTestRow(r);
    lines.push(FIT_TEST_COLUMNS.map((c) => csvField(row[c])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/** "choudo-fit-tests-2026-11-18.csv" */
export function csvFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `choudo-fit-tests-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
