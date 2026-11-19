/**
 * Turning fit results into words and numbers for the screen. All user-facing
 * fit copy lives here so it stays consistent.
 */

import type { FitLabel, GarmentFit, ZoneFit, ZoneId } from '../domain/fit';
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
