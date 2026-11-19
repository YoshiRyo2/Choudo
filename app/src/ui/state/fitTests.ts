/**
 * Test mode: what the app predicted for a garment and size, next to how it
 * actually fit a tester, and the CSV that goes into data/fit_tests.csv.
 * `npm run fit:report` reads that CSV (see domain/fit/fitTestReport.ts).
 */

import type { BodyInput, BodyModel } from '../../domain/body';
import {
  chestTarget,
  FIT_TEST_COLUMNS,
  fitGarment,
  resolvePreference,
  VERDICTS,
  type Anchor,
  type FitTestColumn,
  type GarmentOdds,
  type PreferenceSpec,
  type ZoneOdds,
} from '../../domain/fit';
import type { Garment } from '../../domain/garments';
import type { ChestAnswer, FitTestPrediction, FitTestRecord, LengthAnswer, ZoneChances } from './stored';

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
  const labelOf = (zone: string) => fit.zones.find((z) => z.zone === zone)?.label ?? 'unknown';
  const verdict = VERDICTS.reduce((best, v) => (sizeOdds.verdicts[v] > sizeOdds.verdicts[best] ? v : best), VERDICTS[0]!);
  return {
    body,
    chestCm: model.measurements.chestCm,
    chestSource: model.sources.chestCm,
    torsoLengthCm: model.measurements.torsoLengthCm,
    preferenceSource: preference.source,
    style: preference.style,
    anchor: preference.source === 'anchor' ? anchorText(anchor) : '',
    preferredChestEaseCm: chestTarget(pref, garment.fitIntent).easeCm,
    preferredLengthDiffCm: pref.lengthDiffCm,
    recommendedSize: odds.recommended,
    verdict,
    likes: sizeOdds.likes,
    chestLabel: labelOf('chest'),
    lengthLabel: labelOf('length'),
    chest: chances(sizeOdds.zones.find((z) => z.zone === 'chest')),
    length: chances(sizeOdds.zones.find((z) => z.zone === 'length')),
  };
}

export interface TesterAnswers {
  tester: string;
  chest: ChestAnswer;
  length: LengthAnswer;
  keptSize: string | null;
}

export function makeFitTest(id: string, at: string, garmentId: string, size: string, answers: TesterAnswers, prediction: FitTestPrediction): FitTestRecord {
  return { id, at, garmentId, size, ...answers, tester: answers.tester.trim(), prediction };
}

const cm = (v: number | null) => (v === null ? '' : v.toFixed(1));
const p = (v: number) => v.toFixed(3);

/** One CSV row's values, by column. */
export function fitTestRow(r: FitTestRecord): Record<FitTestColumn, string> {
  const x = r.prediction;
  return {
    tester: r.tester,
    recorded_at: r.at,
    garment_id: r.garmentId,
    size: r.size,
    height_cm: cm(x.body.heightCm),
    weight_kg: cm(x.body.weightKg),
    sizing: x.body.sizing,
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
    predicted_chest_label: x.chestLabel,
    predicted_length_label: x.lengthLabel,
    p_chest_too_tight: p(x.chest.under),
    p_chest_just_right: p(x.chest.right),
    p_chest_too_loose: p(x.chest.over),
    p_length_too_short: p(x.length.under),
    p_length_just_right: p(x.length.right),
    p_length_too_long: p(x.length.over),
    actual_chest: r.chest,
    actual_length: r.length,
    kept_size: r.keptSize ?? 'none',
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

/** "nimbus-fit-tests-2026-11-18.csv" */
export function csvFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `nimbus-fit-tests-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
