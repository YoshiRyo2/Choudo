/**
 * Fit odds instead of one hard answer.
 *
 * We don't know the body, the garment or the user's taste exactly, so we draw
 * each from its spread (uncertainty.ts) a few hundred times, run the ordinary
 * fit engine on every draw, and count how often each label and verdict comes up.
 *
 * Each draw uses:
 *  - one body, shared by every size (so sizes compare fairly) and by the anchor
 *    (so an anchor cancels out an error in the estimated chest);
 *  - one garment offset per measurement, shared by every size (if a chart is
 *    off, it's off for the whole run of sizes);
 *  - one draw of the preference.
 *
 * Pure: the generator is seeded, so the same inputs always give the same odds.
 */

import { BODY_MEASUREMENT_KEYS, type BodyModel, type MeasurementKey as BodyKey } from '../body';
import {
  isGirthKey,
  MEASUREMENT_KEYS,
  normalizeMeasurements,
  type Garment,
  type GarmentSize,
  type MeasurementKey,
} from '../garments';
import { fitGarment, type FitLabel, type ZoneFit, type ZoneId } from './fitEngine';
import {
  LIKED_VERDICTS,
  personalFit,
  resolvePreference,
  VERDICTS,
  type PersonalResult,
  type PreferenceSpec,
  type Verdict,
} from './preference';
import { keyedSeed, normal, seededRng } from './random';
import { girthRuleInCm } from './rules';
import { measurableKeys, templateZones, zoneRule, type MeasurableKey } from './zones';
import {
  ENTERED_BODY_SD_CM,
  BRA_BUST_SD_CM,
  CUP_TORSO_FREE_IN,
  CUP_TORSO_SD_CM_PER_IN,
  ESTIMATED_BODY_SD_CM,
  GARMENT_SD_CM,
  HINT_Z,
  PREFERENCE_SD_CM,
  SAMPLE_COUNT,
  SAMPLER_SEED,
} from './uncertainty';

export interface ZoneOdds {
  zone: ZoneId;
  kind: ZoneFit['kind'];
  /** Chance of each objective label (tight, fitted, …). Labels that never came up are left out. */
  labels: Partial<Record<FitLabel, number>>;
  /** Chance of under / right / over against what the user likes. */
  personal: Record<PersonalResult, number>;
}

export interface SizeOdds {
  sizeLabel: string;
  zones: ZoneOdds[];
  /** Chance of each overall verdict; sums to 1. */
  verdicts: Record<Verdict, number>;
  /** Chance it "fits how you like": fits + as designed. */
  likes: number;
  /**
   * Average distance (cm) of the girths from what we aim for: the personal chest
   * target on tops, the engine's ideal ease elsewhere. Breaks ties when no size
   * is ever liked. null when no girth could be scored.
   */
  meanGirthMissCm: number | null;
}

export interface GarmentOdds {
  garmentId: string;
  sizes: SizeOdds[];
  /** The size most likely to fit how the user likes, or null (see pickSize). */
  recommended: string | null;
  samples: number;
}

export interface SampleOptions {
  samples?: number;
  seed?: number;
}

// Every key in the schema is drawn, whatever the template, so a new measurement is
// sampled without touching this file.
const GARMENT_KEYS = MEASUREMENT_KEYS;

/**
 * The keys the main random stream draws, in this order, every sample. FROZEN:
 * never add to these. A seed then keeps meaning the same draws for every garment
 * whatever keys come later. Every other key draws from its own stream
 * (keyedSeed), once per sample, so adding a key never moves an existing result.
 */
export const MAIN_STREAM_BODY_KEYS: readonly BodyKey[] = [
  'chestCm',
  'waistCm',
  'hipsCm',
  'inseamCm',
  'shoulderWidthCm',
  'armLengthCm',
  'torsoLengthCm',
];
export const MAIN_STREAM_GARMENT_KEYS: readonly MeasurementKey[] = [
  'chest',
  'waist',
  'hips',
  'length',
  'sleeve',
  'shoulder',
  'inseam',
  'rise',
];
const OWN_STREAM_BODY_KEYS = BODY_MEASUREMENT_KEYS.filter((k) => !MAIN_STREAM_BODY_KEYS.includes(k));
const OWN_STREAM_GARMENT_KEYS = GARMENT_KEYS.filter((k) => !MAIN_STREAM_GARMENT_KEYS.includes(k));

/** audit − chart (cm) for each measurement the audit covers. Empty without an audit. */
export function auditGapsCm(garment: Garment): Partial<Record<MeasurementKey, number>> {
  const audit = garment.audit;
  if (!audit) return {};
  const size = garment.sizes.find((s) => s.label === audit.measuredSize);
  if (!size) return {};
  const measured = normalizeMeasurements(audit.measurements, { unit: audit.unit, girth: 'flat' });
  const gaps: Partial<Record<MeasurementKey, number>> = {};
  for (const key of GARMENT_KEYS) {
    const a = measured[key];
    const c = size.measurements[key];
    if (a !== undefined && c !== undefined) gaps[key] = a - c;
  }
  return gaps;
}

/**
 * 1 SD on one garment number: by the garment's grade, or by the value's own
 * origin (estimated / audited), widened to the audit gap when there is one.
 */
export function garmentSdCm(garment: Garment, size: GarmentSize, key: MeasurementKey, gaps = auditGapsCm(garment)): number {
  const kind = isGirthKey(key) ? 'girth' : 'length';
  const origin = size.provenance[key]?.origin;
  const grade =
    origin === 'estimated' ? 'estimated' : origin === 'audited' ? 'verified' : garment.grade === 'unscored' ? 'charted' : garment.grade;
  const gap = gaps[key];
  return Math.max(GARMENT_SD_CM[grade][kind], gap === undefined ? 0 : Math.abs(gap));
}

/**
 * 1 SD on one body number: wider when estimated than when typed in, its own
 * spread for a bust from a bra size, and a wider torso length for a fuller cup.
 */
export function bodySdCm(body: BodyModel, key: BodyKey): number {
  const bra = body.bra;
  let sd = body.sources[key] === 'entered' ? ENTERED_BODY_SD_CM : ESTIMATED_BODY_SD_CM[body.measurements.bodyType][key];
  if (key === 'chestCm' && body.sources.chestCm === 'estimated' && bra?.setsBust) sd = BRA_BUST_SD_CM;
  if (key === 'torsoLengthCm' && bra && bra.cupIn > CUP_TORSO_FREE_IN) {
    sd = Math.hypot(sd, CUP_TORSO_SD_CM_PER_IN * (bra.cupIn - CUP_TORSO_FREE_IN));
  }
  return sd;
}

/** The ideal ease (cm) the engine aims for on a girth zone without a personal target: the zone's own rule. */
function idealEaseCm(garment: Garment, zone: ZoneFit): number {
  const rule = zoneRule(garment, zone.zone);
  return rule?.kind === 'girth' ? girthRuleInCm(rule, zone.bodyCm).ideal : 0;
}

const emptyPersonal = (): Record<PersonalResult, number> => ({ under: 0, right: 0, over: 0, unknown: 0 });
const emptyVerdicts = (): Record<Verdict, number> =>
  Object.fromEntries(VERDICTS.map((v) => [v, 0])) as Record<Verdict, number>;

interface Tally {
  zones: Map<ZoneId, { kind: ZoneFit['kind']; labels: Partial<Record<FitLabel, number>>; personal: Record<PersonalResult, number> }>;
  verdicts: Record<Verdict, number>;
  missSum: number;
  missCount: number;
}

/** Fit odds for every size of a garment, in chart order. */
export function sampleFit(
  body: BodyModel,
  garment: Garment,
  spec: PreferenceSpec,
  { samples = SAMPLE_COUNT, seed = SAMPLER_SEED }: SampleOptions = {},
): GarmentOdds {
  const rng = seededRng(seed);
  const bodyStreams = OWN_STREAM_BODY_KEYS.map((k) => [k, seededRng(keyedSeed(seed, k))] as const);
  const garmentStreams = OWN_STREAM_GARMENT_KEYS.map((k) => [k, seededRng(keyedSeed(seed, k))] as const);
  const gaps = auditGapsCm(garment);
  const sds = garment.sizes.map((s) =>
    Object.fromEntries(GARMENT_KEYS.map((k) => [k, garmentSdCm(garment, s, k, gaps)])) as Record<MeasurementKey, number>,
  );
  const tallies: Tally[] = garment.sizes.map(() => ({ zones: new Map(), verdicts: emptyVerdicts(), missSum: 0, missCount: 0 }));
  const personalGirth = templateZones(garment).personal?.girth ?? null;
  const anchor = spec.anchor;
  const anchorIsThisChart = anchor !== null && anchor.garmentId === garment.id;
  const prefChestSd = anchor ? PREFERENCE_SD_CM.anchorChest : PREFERENCE_SD_CM.style;

  for (let i = 0; i < samples; i++) {
    // Draw everything in a fixed order so a seed always means the same draws.
    const measurements = { ...body.measurements };
    for (const key of MAIN_STREAM_BODY_KEYS) measurements[key] = body.measurements[key] + normal(rng) * bodySdCm(body, key);
    const drawnBody: BodyModel = { measurements, sources: body.sources };

    const z = Object.fromEntries(MAIN_STREAM_GARMENT_KEYS.map((k) => [k, normal(rng)])) as Record<MeasurementKey, number>;
    // Keys added since: one draw each from their own stream (they never touch rng).
    for (const [key, own] of bodyStreams) measurements[key] = body.measurements[key] + normal(own) * bodySdCm(body, key);
    for (const [key, own] of garmentStreams) z[key] = normal(own);
    const drawnGarment: Garment = {
      ...garment,
      sizes: garment.sizes.map((s, si) => {
        const m = { ...s.measurements };
        for (const key of GARMENT_KEYS) {
          const v = m[key];
          if (v !== undefined) m[key] = v + z[key] * sds[si]![key];
        }
        return { ...s, measurements: m };
      }),
    };

    const anchorChestZ = normal(rng);
    const anchorLengthZ = normal(rng);
    const prefChestZ = normal(rng);
    const prefLengthZ = normal(rng);
    const pref = resolvePreference(spec, measurements, {
      // The anchor is one of this garment's sizes: the same chart, so the same offset.
      anchorChestCm: anchor ? (anchorIsThisChart ? z.chest : anchorChestZ) * anchor.sdCm.girth : 0,
      anchorLengthCm: anchor ? (anchorIsThisChart ? z.length : anchorLengthZ) * anchor.sdCm.length : 0,
      chestEaseCm: prefChestZ * prefChestSd,
      lengthDiffCm: anchor ? prefLengthZ * PREFERENCE_SD_CM.anchorLength : 0,
    });

    garment.sizes.forEach((s, si) => {
      const fit = fitGarment(drawnBody, drawnGarment, s.label);
      const personal = personalFit(fit, drawnGarment, pref);
      const t = tallies[si]!;
      t.verdicts[personal.verdict] += 1;
      let miss = 0;
      let scored = false;
      for (const zf of fit.zones) {
        let zt = t.zones.get(zf.zone);
        if (!zt) {
          zt = { kind: zf.kind, labels: {}, personal: emptyPersonal() };
          t.zones.set(zf.zone, zt);
        }
        zt.labels[zf.label] = (zt.labels[zf.label] ?? 0) + 1;
        zt.personal[personal.zones[zf.zone] ?? 'unknown'] += 1;
        if (zf.kind === 'girth' && zf.diffCm !== null) {
          scored = true;
          miss +=
            zf.zone === personalGirth && personal.chestMissCm !== null
              ? Math.abs(personal.chestMissCm)
              : Math.abs(zf.diffCm - idealEaseCm(garment, zf));
        }
      }
      if (scored) {
        t.missSum += miss;
        t.missCount += 1;
      }
    });
  }

  const share = (n: number) => n / samples;
  const sizes: SizeOdds[] = garment.sizes.map((s, si) => {
    const t = tallies[si]!;
    const verdicts = emptyVerdicts();
    for (const v of VERDICTS) verdicts[v] = share(t.verdicts[v]);
    return {
      sizeLabel: s.label,
      zones: [...t.zones].map(([zone, zt]) => ({
        zone,
        kind: zt.kind,
        labels: Object.fromEntries(Object.entries(zt.labels).map(([l, n]) => [l, share(n)])),
        personal: {
          under: share(zt.personal.under),
          right: share(zt.personal.right),
          over: share(zt.personal.over),
          unknown: share(zt.personal.unknown),
        },
      })),
      verdicts,
      likes: LIKED_VERDICTS.reduce((sum, v) => sum + verdicts[v], 0),
      meanGirthMissCm: t.missCount > 0 ? t.missSum / t.missCount : null,
    };
  });

  return { garmentId: garment.id, sizes, recommended: pickSize(sizes, garment), samples };
}

/**
 * The size most likely to fit how the user likes; ties go to the roomier size.
 * If no size is ever liked, the one whose girths come closest on average.
 * null for an unscored garment, or when no girth could be scored at all —
 * we never recommend on length alone.
 */
export function pickSize(sizes: SizeOdds[], garment: Pick<Garment, 'grade'>): string | null {
  if (garment.grade === 'unscored') return null;
  const scorable = sizes.filter((s) => s.meanGirthMissCm !== null);
  if (scorable.length === 0) return null;
  let best = scorable[0]!;
  for (const s of scorable) if (s.likes >= best.likes) best = s; // >=: later sizes are roomier
  if (best.likes > 0) return best.sizeLabel;
  for (const s of scorable) if (s.meanGirthMissCm! <= best.meanGirthMissCm!) best = s;
  return best.sizeLabel;
}

/** The size we'd suggest, or null when we can't pick one. */
export function recommendSize(body: BodyModel, garment: Garment, spec: PreferenceSpec, options?: SampleOptions): string | null {
  return sampleFit(body, garment, spec, options).recommended;
}

export type { MeasurableKey } from './zones';

export interface MeasureHint {
  key: MeasurableKey;
  /** The sizes the answer moves between, in chart order. */
  sizes: string[];
}

/**
 * Which body measurement, if typed in, could change the size we'd suggest.
 * For each estimated measurement the garment uses, we re-run the suggestion as
 * if the user had measured it at the low and high ends of our estimate (10th and
 * 90th percentile). If the suggestion moves, that measurement decides it.
 * With an anchor tee the chest rarely matters: the anchor moves with it.
 */
export function measurementHint(
  body: BodyModel,
  garment: Garment,
  spec: PreferenceSpec,
  options?: SampleOptions & { current?: string | null },
): MeasureHint | null {
  const current = options?.current !== undefined ? options.current : recommendSize(body, garment, spec, options);
  if (current === null) return null;
  const order = garment.sizes.map((s) => s.label);
  for (const key of measurableKeys(garment)) {
    if (body.sources[key] !== 'estimated') continue;
    const picks = new Set<string>([current]);
    for (const z of [-HINT_Z, HINT_Z]) {
      const measured: BodyModel = {
        measurements: { ...body.measurements, [key]: body.measurements[key] + z * bodySdCm(body, key) },
        sources: { ...body.sources, [key]: 'entered' },
      };
      const pick = recommendSize(measured, garment, spec, options);
      if (pick !== null) picks.add(pick);
    }
    if (picks.size > 1) return { key, sizes: order.filter((l) => picks.has(l)) };
  }
  return null;
}
