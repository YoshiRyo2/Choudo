/**
 * Turning fit results into words and numbers for the screen. All user-facing
 * fit copy lives here so it stays consistent.
 */

import type { FitLabel, GarmentFit, ZoneFit, ZoneId } from '../domain/fit';
import type { ConfidenceGrade, Garment, SourceTier } from '../domain/garments';
import { cmToIn } from '../domain/units';
import type { UnitSystem } from './state/stored';

export const ZONE_NAME: Record<ZoneId, string> = {
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  length: 'Length',
  sleeve: 'Sleeve',
  inseam: 'Inseam',
};

export const LABEL_TEXT: Record<FitLabel, string> = {
  tight: 'Tight',
  fitted: 'Fitted',
  relaxed: 'Relaxed',
  loose: 'Loose',
  short: 'Short',
  good: 'Good length',
  long: 'Long',
  unknown: 'Can’t tell',
};

/** Where on the body a label applies, for summaries: "Tight at the waist". */
const ZONE_PLACE: Record<ZoneId, string> = {
  chest: 'at the chest',
  waist: 'at the waist',
  hips: 'at the hips',
  length: 'in length',
  sleeve: 'in the sleeves',
  inseam: 'in the leg',
};

const MINUS = '−';

/** 12.34 cm -> "12.3 cm" or "4.9 in". */
export function formatLength(cm: number, units: UnitSystem): string {
  return units === 'metric' ? `${cm.toFixed(1)} cm` : `${cmToIn(cm).toFixed(1)} in`;
}

/** Signed difference with a real minus sign: "+2.0 cm", "−0.8 in". */
export function formatDiff(cm: number, units: UnitSystem): string {
  const value = units === 'metric' ? cm : cmToIn(cm);
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return units === 'metric' ? '0 cm' : '0 in';
  const sign = rounded > 0 ? '+' : MINUS;
  return `${sign}${Math.abs(rounded).toFixed(1)} ${units === 'metric' ? 'cm' : 'in'}`;
}

/** Under this many cm we say "matches" instead of quoting a tiny number. */
const MATCH_CM = 0.5;

/** One plain sentence about a zone. */
export function describeZone(z: ZoneFit, units: UnitSystem): string {
  if (z.diffCm === null) return z.note ?? 'The size chart doesn’t give us enough to compare.';
  const d = formatLength(Math.abs(z.diffCm), units);
  const over = z.diffCm >= MATCH_CM;
  const under = z.diffCm <= -MATCH_CM;
  const part = ZONE_NAME[z.zone].toLowerCase();

  switch (z.zone) {
    case 'chest':
    case 'waist':
    case 'hips':
      if (over) return `${d} of room at your ${part}.`;
      if (!under) return `Matches your ${part} exactly.`;
      return z.label === 'tight'
        ? `${d} smaller than your ${part}.`
        : `${d} smaller than your ${part}, but the fabric stretches.`;
    case 'length':
      if (over) return `Ends ${d} lower than a regular-length top would on you.`;
      if (under) return `Ends ${d} higher than a regular-length top would on you.`;
      return 'A regular length on you.';
    case 'sleeve':
      if (over) return `Cuff ends ${d} past your wrist.`;
      if (under) return `Cuff ends ${d} short of your wrist.`;
      return 'Cuff ends right at your wrist.';
    case 'inseam':
      if (over) return `${d} longer than your inseam.`;
      if (under) return `${d} shorter than your inseam.`;
      return 'Matches your inseam.';
  }
}

export interface FitSummary {
  headline: string;
  detail: string | null;
  /** True when any scored zone relied on an estimated body measurement. */
  usesEstimates: boolean;
}

export function summarize(fit: GarmentFit): FitSummary {
  const scored = fit.zones.filter((z) => z.diffCm !== null);
  const usesEstimates = scored.some((z) => z.bodySource === 'estimated');
  const problems = fit.zones.filter((z) => z.tone === fit.overall && z.tone !== 'good');
  const detail =
    problems.length > 0
      ? sentence(problems.map((z) => `${LABEL_TEXT[z.label].toLowerCase()} ${ZONE_PLACE[z.zone]}`))
      : null;

  switch (fit.overall) {
    case 'good':
      return { headline: 'Should fit well', detail: null, usesEstimates };
    case 'warn':
      return { headline: 'Wearable, with a catch', detail, usesEstimates };
    case 'bad':
      return { headline: 'Probably won’t fit', detail, usesEstimates };
    default: {
      const unchecked = fit.zones.filter((z) => z.label === 'unknown').map((z) => ZONE_NAME[z.zone].toLowerCase());
      return {
        headline: 'Can’t check this fit',
        detail:
          unchecked.length > 0
            ? `This size chart doesn’t let us compare the ${listOf(unchecked)}.`
            : 'This size chart doesn’t give the numbers we need to compare.',
        usesEstimates,
      };
    }
  }
}

/** ["chest", "waist"] -> "chest and waist" */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** ["tight at the waist", "short in the leg"] -> "Tight at the waist, short in the leg." */
function sentence(parts: string[]): string {
  const text = parts.join(', ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** The size line on a Discover card or Closet tile. */
export function sizeLine(size: string, recommended: boolean): string {
  return recommended ? `Your size: ${size}` : `Size ${size} · we couldn’t pick one for you`;
}

// ---------- where the numbers came from ----------

/** The small badge on a garment card. */
export const GRADE_BADGE: Record<ConfidenceGrade, string> = {
  verified: 'Verified',
  charted: 'From size chart',
  estimated: 'Estimated',
  unscored: 'Can’t score',
};

/** One line on what a grade means, for the fit readout. */
export const GRADE_EXPLAINED: Record<ConfidenceGrade, string> = {
  verified: 'Copied from the size chart and checked against a real garment we measured.',
  charted: 'Copied from the size chart and checked for mistakes, but not yet measured on a real garment.',
  estimated: 'Some of these numbers are our estimates, not the brand’s, so treat this fit as a guide.',
  unscored: 'The chart doesn’t say how some measurements are taken, so we can’t score those.',
};

/** Each source tier in plain words: "From <this>". */
export const TIER_PLAIN: Record<SourceTier, string> = {
  A: 'the brand’s own spec sheet',
  B: 'a published garment size chart',
  C: 'a print partner’s product data',
  D: 'a retailer’s product listing',
  E: 'a garment measured by hand',
  F: 'a body-size chart only, with no garment measurements',
  G: 'a product photo only',
};

/** Shown next to a garment number that we estimated rather than copied. */
export const ESTIMATED_MARK = 'est.';

export type GarmentTag = { kind: 'sample' | ConfidenceGrade; text: string };

/** The card tag: "Sample data" for invented rows, otherwise the grade badge. */
export function garmentTag(garment: Pick<Garment, 'source' | 'grade'>): GarmentTag {
  if (garment.source.placeholder) return { kind: 'sample', text: 'Sample data' };
  return { kind: garment.grade, text: GRADE_BADGE[garment.grade] };
}

/** "2026-11-18" -> "18 Nov 2026" in the reader's locale. */
export function formatCapturedOn(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "From a published garment size chart, copied 18 Nov 2026." */
export function sourceLine(garment: Pick<Garment, 'source'>): string {
  const { tier, capturedOn } = garment.source;
  const from = tier ? `From ${TIER_PLAIN[tier]}` : 'From the brand’s size chart';
  return `${from}${capturedOn ? `, copied ${formatCapturedOn(capturedOn)}` : ''}.`;
}
