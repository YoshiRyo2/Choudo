/**
 * Turning fit results into words and numbers for the screen. All user-facing
 * fit copy lives here so it stays consistent.
 */

import {
  VERDICTS,
  type Anchor,
  type FitLabel,
  type FitStyle,
  type FitTone,
  type GarmentFit,
  type GarmentOdds,
  type MeasurableKey,
  type MeasureHint,
  type PreferenceSpec,
  type Verdict,
  type ZoneFit,
  type ZoneId,
  type ZoneOdds,
} from '../domain/fit';
import { RISE_VERTICAL_RATIO, type BodyType } from '../domain/body';
import type { ConfidenceGrade, FitIntent, Garment, SourceTier } from '../domain/garments';
import { cmToIn } from '../domain/units';
import type { UnitSystem } from './state/stored';

export const ZONE_NAME: Record<ZoneId, string> = {
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  length: 'Length',
  sleeve: 'Sleeve',
  inseam: 'Inseam',
  thigh: 'Thigh',
  rise: 'Rise',
  legOpening: 'Leg opening',
  hemBand: 'Hem band',
  walkingRoom: 'Walking room',
};

export const LABEL_TEXT: Record<FitLabel, string> = {
  tight: 'Tight',
  fitted: 'Fitted',
  relaxed: 'Relaxed',
  loose: 'Loose',
  short: 'Short',
  good: 'Good length',
  long: 'Long',
  // Landing zones say where an edge ends; zoneLabelText shows the mark instead ("Mid rise").
  noted: 'Where it ends',
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
  thigh: 'at the thigh',
  rise: 'in the rise',
  legOpening: 'at the hem',
  hemBand: 'at the hem band',
  walkingRoom: 'at the hem',
};

/**
 * A zone's name for this body: the engine has one chest zone, which a women's
 * body calls the bust. "Chest" / "Bust", "Waist", ...
 */
export function zoneName(zone: ZoneId, bodyType: BodyType = 'mens'): string {
  return zone === 'chest' && bodyType === 'womens' ? 'Bust' : ZONE_NAME[zone];
}

/** "at the chest" / "at the bust", "in length", ... */
function zonePlace(zone: ZoneId, bodyType: BodyType): string {
  return zone === 'chest' && bodyType === 'womens' ? 'at the bust' : ZONE_PLACE[zone];
}

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
export function describeZone(z: ZoneFit, units: UnitSystem, bodyType: BodyType = 'mens'): string {
  if (z.diffCm === null) return z.note ?? 'The size chart doesn’t give us enough to compare.';
  const d = formatLength(Math.abs(z.diffCm), units);
  const over = z.diffCm >= MATCH_CM;
  const under = z.diffCm <= -MATCH_CM;
  const part = zoneName(z.zone, bodyType).toLowerCase();

  // A blocked landing (won't go on, won't stay up): the engine says why.
  if (z.kind === 'landing' && z.tone === 'bad' && z.note) return z.note;

  switch (z.zone) {
    case 'chest':
    case 'waist':
    case 'hips':
    case 'thigh':
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
    case 'rise': {
      // The rise difference is along the body; the band moves this share of it up or down.
      const v = RISE_VERTICAL_RATIO[bodyType] * z.diffCm;
      const where =
        Math.abs(v) < MATCH_CM
          ? 'at your navel'
          : `about ${formatLength(Math.abs(v), units)} ${v > 0 ? 'above' : 'below'} your navel`;
      return `${LANDING_TEXT[z.landing ?? ''] ?? 'This rise'}: the waistband sits ${where}.`;
    }
    case 'legOpening':
      if (z.diffCm < 0) {
        return `${LANDING_TEXT[z.landing ?? ''] ?? 'Narrow'}: ${d} narrower than your heel, so it relies on stretch or a zip to get on.`;
      }
      return `${LANDING_TEXT[z.landing ?? ''] ?? 'This leg'}: ${d} wider than your heel.`;
    case 'hemBand':
      // A rib band is measured relaxed and meant to gather onto the body.
      if (over) return z.label === 'loose' ? `${d} wider than your hips, so it hangs open rather than gathering.` : `${d} wider than your hips, relaxed.`;
      if (!under) return 'Matches your hips, relaxed.';
      return z.label === 'tight'
        ? `${d} smaller than your hips: more than the rib can stretch.`
        : `${d} smaller than your hips, relaxed; the rib stretches to gather there.`;
    case 'walkingRoom':
      if (under) return `${d} short of a full stride at the hem: expect shorter steps.`;
      return 'Room for a full stride at the hem.';
  }
}

/**
 * Where a worked-out body number was taken, after "You 84.1 cm": the waist of a
 * jean is where its band sits; a knit's centre-back length and sleeve start at the back neck.
 */
export function bodyPlaceText(z: ZoneFit): string {
  if (z.bodyAt === 'band') return ' where the waistband sits';
  if (z.bodyAt === 'centre_back') return z.zone === 'sleeve' ? ' from the centre of your back to the wrist' : ' from the back of your neck';
  return '';
}

/** How a landing zone's mark reads on its own: "Mid rise", "Straight leg". */
const LANDING_TEXT: Record<string, string> = {
  low: 'Low rise',
  mid: 'Mid rise',
  high: 'High rise',
  skinny: 'Skinny',
  slim: 'Slim leg',
  straight: 'Straight leg',
  wide: 'Wide leg',
};

/**
 * A zone's short label for the readout: the objective label for girths and
 * lengths, where it lands for a landing zone, and what goes wrong when one blocks.
 */
export function zoneLabelText(z: ZoneFit): string {
  if (z.kind === 'landing') {
    if (z.label === 'tight') return 'Won’t go on';
    if (z.label === 'short') return 'Won’t stay up';
    if (z.label === 'noted' && z.landing) return LANDING_TEXT[z.landing] ?? LABEL_TEXT.noted;
  }
  return LABEL_TEXT[z.label];
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
      ? sentence(problems.map((z) => `${zoneLabelText(z).toLowerCase()} ${zonePlace(z.zone, fit.bodyType)}`))
      : null;

  switch (fit.overall) {
    case 'good':
      return { headline: 'Should fit well', detail: null, usesEstimates };
    case 'warn':
      return { headline: 'Wearable, with a catch', detail, usesEstimates };
    case 'bad':
      return { headline: 'Probably won’t fit', detail, usesEstimates };
    default: {
      const unchecked = fit.zones.filter((z) => z.label === 'unknown').map((z) => zoneName(z.zone, fit.bodyType).toLowerCase());
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

// ---------- how the user likes tops to fit ----------

/** The answers to "How do you like tees to fit?". */
export const FIT_STYLE_TEXT: Record<FitStyle, { label: string; hint: string }> = {
  slim: { label: 'Slim', hint: 'Close to the body, not tight' },
  regular: { label: 'Regular', hint: 'Room to move, not baggy' },
  relaxed: { label: 'Relaxed', hint: 'Easy and a little loose' },
  oversized: { label: 'Oversized', hint: 'Big and boxy, on purpose' },
};

/** One line on the fit reference, for Edit body. */
export function fitReferenceLine(
  anchor: Anchor | null,
  style: FitStyle | null,
  units: UnitSystem,
  find: (id: string) => Garment | undefined,
): string {
  if (anchor?.kind === 'catalogue') {
    const g = find(anchor.garmentId);
    if (g) return `Your ${g.brand} ${g.name} in ${anchor.size}.`;
  }
  if (anchor?.kind === 'measured') {
    const show = (cm: number) =>
      units === 'metric' ? `${Math.round(cm)} cm` : `${cmToIn(cm).toFixed(1)} in`;
    return `A tee you measured: ${show(anchor.chestFlatCm)} across, ${show(anchor.lengthCm)} long.`;
  }
  if (style) return `You like tees ${FIT_STYLE_TEXT[style].label.toLowerCase()}.`;
  return 'Not set yet, so we assume you like a regular fit.';
}

// ---------- personal verdicts and odds ----------

/** Odds at or above these get "Very likely" / "Probably"; below, "Might". */
export const CERTAINTY = { veryLikely: 0.75, probably: 0.5 };
/** Two sizes this close (and both at least `min`) are a close call: "Could go either way". */
export const CLOSE_CALL = { min: 0.25, gap: 0.15 };

interface Phrase {
  /** After "Very likely" / "Probably". */
  plain: string;
  /** On its own, when we're less sure. */
  might: string;
}

const TOP_PHRASE: Record<Exclude<Verdict, 'unknown' | 'as-designed'>, Phrase> = {
  fits: { plain: 'fits how you like', might: 'Might fit how you like' },
  snugger: { plain: 'a bit snugger than you like', might: 'Might be a bit snugger than you like' },
  'too-tight': { plain: 'too tight', might: 'Might be too tight' },
  roomier: { plain: 'roomier than you like', might: 'Might be roomier than you like' },
  'much-roomier': { plain: 'much roomier than you like', might: 'Might be much roomier than you like' },
  shorter: { plain: 'shorter than you like', might: 'Might be shorter than you like' },
  longer: { plain: 'longer than you like', might: 'Might be longer than you like' },
};

/** Bottoms have no personal preference yet, so their words stay objective. */
const BOTTOM_PHRASE: Record<Exclude<Verdict, 'unknown' | 'as-designed'>, Phrase> = {
  fits: { plain: 'fits well', might: 'Might fit well' },
  snugger: { plain: 'snug', might: 'Might be snug' },
  'too-tight': { plain: 'too tight', might: 'Might be too tight' },
  roomier: { plain: 'roomy', might: 'Might be roomy' },
  'much-roomier': { plain: 'very roomy', might: 'Might be very roomy' },
  shorter: { plain: 'short in the leg', might: 'Might be short in the leg' },
  longer: { plain: 'long in the leg', might: 'Might be long in the leg' },
};

const INTENT_WORD: Record<FitIntent, string> = { slim: 'slim', regular: 'regular', relaxed: 'relaxed', oversized: 'oversized' };

function phraseFor(verdict: Exclude<Verdict, 'unknown'>, garment: Pick<Garment, 'category' | 'fitIntent'>): Phrase {
  if (verdict === 'as-designed') {
    const word = INTENT_WORD[garment.fitIntent];
    return { plain: `${word}, as designed`, might: `Might be ${word}, as designed` };
  }
  return (garment.category === 'top' ? TOP_PHRASE : BOTTOM_PHRASE)[verdict];
}

const VERDICT_TONE: Record<Verdict, FitTone> = {
  fits: 'good',
  'as-designed': 'good',
  snugger: 'warn',
  roomier: 'warn',
  shorter: 'warn',
  longer: 'warn',
  'much-roomier': 'bad',
  'too-tight': 'bad',
  unknown: 'unknown',
};

/**
 * 0.473 -> "47%". Odds come from sampling, so a chance is never shown as a flat
 * "0%" or "100%": anything that would round to 0 reads "<1%" and to 100 ">99%".
 */
export function formatPercent(p: number): string {
  const rounded = Math.round(p * 100);
  if (rounded < 1) return '<1%';
  if (rounded > 99) return '>99%';
  return `${rounded}%`;
}

export interface VerdictLine {
  headline: string;
  /** The chance it fits how you like, in words. null when we can't tell. */
  detail: string | null;
  tone: FitTone;
  verdict: Verdict;
}

/**
 * The headline for one size: the most likely verdict, worded by how sure we are,
 * or "Could go either way: M or L" when this size and another are close.
 */
export function verdictLine(odds: GarmentOdds, sizeLabel: string, garment: Pick<Garment, 'category' | 'fitIntent'>): VerdictLine {
  const size = odds.sizes.find((s) => s.sizeLabel === sizeLabel);
  if (!size || size.verdicts.unknown >= 0.5) {
    return { headline: 'Can’t check this fit', detail: null, tone: 'unknown', verdict: 'unknown' };
  }
  const liked = garment.category === 'top' ? 'fits how you like' : 'fits well';
  const detail = `${formatPercent(size.likes)} chance it ${liked}.`;

  const known = VERDICTS.filter((v): v is Exclude<Verdict, 'unknown'> => v !== 'unknown');
  const modal = known.reduce((best, v) => (size.verdicts[v] > size.verdicts[best] ? v : best), known[0]!);

  const ranked = [...odds.sizes].sort((a, b) => b.likes - a.likes);
  const [first, second] = ranked;
  if (
    first &&
    second &&
    (first.sizeLabel === sizeLabel || second.sizeLabel === sizeLabel) &&
    second.likes >= CLOSE_CALL.min &&
    first.likes - second.likes <= CLOSE_CALL.gap
  ) {
    const order = odds.sizes.map((s) => s.sizeLabel);
    const pair = [first.sizeLabel, second.sizeLabel].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { headline: `Could go either way: ${pair[0]} or ${pair[1]}`, detail, tone: 'warn', verdict: modal };
  }

  const p = size.verdicts[modal];
  const phrase = phraseFor(modal, garment);
  const headline =
    p >= CERTAINTY.veryLikely ? `Very likely ${phrase.plain}` : p >= CERTAINTY.probably ? `Probably ${phrase.plain}` : phrase.might;
  return { headline, detail, tone: VERDICT_TONE[modal], verdict: modal };
}

const MEASURE_NAME: Record<MeasurableKey, string> = {
  chestCm: 'chest',
  waistCm: 'waist',
  hipsCm: 'hips',
  inseamCm: 'inseam',
};

/** "Measure your chest to decide between M and L." ("bust" for a women's body) */
export function measureHintText(hint: MeasureHint, bodyType: BodyType = 'mens'): string {
  const name = hint.key === 'chestCm' && bodyType === 'womens' ? 'bust' : MEASURE_NAME[hint.key];
  return `Measure your ${name} to decide between ${listOf(hint.sizes)}.`;
}

/**
 * Objective labels by chance, likeliest first: "Fitted 61% · Relaxed 30% · Tight 9%". Under 1% is left out.
 * A landing zone has no scale of labels, only the chance it blocks ("Won’t go on 4%"), or "" when it never does.
 */
export function labelOddsText(z: ZoneOdds): string {
  if (z.kind === 'landing') {
    const blocked = (z.labels.tight ?? 0) + (z.labels.short ?? 0);
    if (blocked < 0.01) return '';
    return `${z.labels.tight ? 'Won’t go on' : 'Won’t stay up'} ${formatPercent(blocked)}`;
  }
  return Object.entries(z.labels)
    .filter(([, p]) => p >= 0.01)
    .sort((a, b) => b[1] - a[1])
    .map(([label, p]) => `${LABEL_TEXT[label as FitLabel]} ${formatPercent(p)}`)
    .join(' · ');
}

const PERSONAL_WORDS: Partial<Record<ZoneId, Record<'under' | 'right' | 'over', string>>> = {
  chest: { under: 'Snugger', right: 'As you like', over: 'Roomier' },
  length: { under: 'Shorter', right: 'As you like', over: 'Longer' },
};

/**
 * Against what the user likes, for the zones with a personal target on tops:
 * "As you like 47% · Roomier 29% · Snugger 24%". null for other zones.
 */
export function personalOddsText(z: ZoneOdds, garment: Pick<Garment, 'category'>, hasLengthPreference: boolean): string | null {
  const words = PERSONAL_WORDS[z.zone];
  if (!words || garment.category !== 'top') return null;
  if (z.zone === 'length' && !hasLengthPreference) return null;
  return (['under', 'right', 'over'] as const)
    .map((k) => [words[k], z.personal[k]] as const)
    .filter(([, p]) => p >= 0.01)
    .sort((a, b) => b[1] - a[1])
    .map(([w, p]) => `${w} ${formatPercent(p)}`)
    .join(' · ');
}

/** What a top's verdict is judged against, in one short line. */
export function preferenceNote(spec: PreferenceSpec): string {
  if (spec.source === 'anchor') return spec.anchor?.garmentId ? 'Compared with the tee you own and like.' : 'Compared with the tee you measured.';
  if (spec.source === 'style') return `Compared with how you like tees: ${FIT_STYLE_TEXT[spec.style].label.toLowerCase()}.`;
  return 'Assuming you like a regular fit. Tell us how you like tees under Edit body.';
}
