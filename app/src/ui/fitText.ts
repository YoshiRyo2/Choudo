/**
 * Turning fit results into words and numbers for the screen. All user-facing
 * fit copy lives here so it stays consistent.
 */

import {
  fitOutfit,
  VERDICTS,
  type Anchor,
  type FitLabel,
  type FitStyle,
  type FitTone,
  type GarmentFit,
  type GarmentOdds,
  type LayerNote,
  type MeasurableKey,
  type MeasureHint,
  type PreferenceSpec,
  type SizeOdds,
  type Verdict,
  type ZoneFit,
  type ZoneId,
  type UnderLayer,
  type WornOver,
  type ZoneOdds,
} from '../domain/fit';
import { RISE_VERTICAL_RATIO, type BodyModel, type BodyType } from '../domain/body';
import type { ConfidenceGrade, FitIntent, Garment, GarmentType, SourceTier, TemplateId } from '../domain/garments';
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
  shoulder: 'Shoulders',
  calf: 'Calf',
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
  shoulder: 'at the shoulders',
  calf: 'at the calf',
};

/**
 * A zone's name for this body: the engine has one chest zone, which a women's
 * body calls the bust. "Chest" / "Bust", "Waist", ...
 */
export function zoneName(zone: ZoneId, bodyType: BodyType = 'mens'): string {
  return zone === 'chest' && bodyType === 'womens' ? 'Bust' : ZONE_NAME[zone];
}

/** A zone's name in the readout: as zoneName, but a leggings inseam (it lands at the ankle) is its "Length". */
export function zoneTitle(z: Pick<ZoneFit, 'zone' | 'bodyAt'>, bodyType: BodyType = 'mens'): string {
  return z.bodyAt === 'ankle' ? 'Length' : zoneName(z.zone, bodyType);
}

/** Leggings are cut under the body, so their girth labels read as squeeze, not tightness. */
const LEGGINGS_LABEL_TEXT: Partial<Record<FitLabel, string>> = { tight: 'Too much squeeze', loose: 'Baggy' };

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

/** Jacket length marks: these hems land against the hip line, not the knee. */
const HIP_LINE_LANDINGS: readonly string[] = ['cropped', 'hip', 'thigh', 'knee-length', 'calf'];

/**
 * One plain sentence about a zone. `template` changes the wording where a
 * template reads differently (leggings are meant to sit under the body).
 */
export function describeZone(z: ZoneFit, units: UnitSystem, bodyType: BodyType = 'mens', template?: TemplateId): string {
  if (z.diffCm === null) return z.note ?? 'The size chart doesn’t give us enough to compare.';
  const d = formatLength(Math.abs(z.diffCm), units);
  const over = z.diffCm >= MATCH_CM;
  const under = z.diffCm <= -MATCH_CM;
  const part = zoneName(z.zone, bodyType).toLowerCase();

  // A blocked landing (won't go on, won't stay up): the engine says why.
  if (z.kind === 'landing' && z.tone === 'bad' && z.note) return z.note;
  // A leggings hem lands against the ankle bone.
  if (z.bodyAt === 'ankle') {
    const name = LANDING_TEXT[z.landing ?? ''] ?? 'Here';
    if (z.landing === 'stacked') return `${name}: runs ${d} past your ankle bone, so it bunches at the ankle.`;
    if (!over && !under) return `${name}: ends at your ankle bone.`;
    return `${name}: ends ${d} ${over ? 'below' : 'above'} your ankle bone.`;
  }
  // Leggings girths: cut under the body on purpose, so the share under it says how snug.
  if (template === 'leggings' && z.kind === 'girth') {
    const pct = Math.round((Math.abs(z.diffCm) / z.bodyCm) * 100);
    if (under) {
      return z.label === 'tight'
        ? `${d} (${pct} %) smaller than your ${part}: more squeeze than the fabric gives.`
        : `${d} (${pct} %) smaller than your ${part}: snug, as leggings are cut.`;
    }
    if (z.label === 'loose') return `${d} bigger than your ${part}, so they won’t hug you.`;
  }
  // A hem landing against the knee: shorts (inseam) and skirts (length).
  if (z.kind === 'landing' && (z.zone === 'inseam' || z.zone === 'length') && !HIP_LINE_LANDINGS.includes(z.landing ?? '')) {
    const where = !over && !under ? 'at your knee' : `${d} ${over ? 'below' : 'above'} your knee`;
    return `${LANDING_TEXT[z.landing ?? ''] ?? 'Here'}: the hem ends ${where}.`;
  }

  switch (z.zone) {
    case 'chest':
    case 'waist':
    case 'hips':
    case 'thigh':
    case 'calf':
      if (over) return `${d} of room at your ${part}.`;
      if (!under) return `Matches your ${part} exactly.`;
      return z.label === 'tight'
        ? `${d} smaller than your ${part}.`
        : `${d} smaller than your ${part}, but the fabric stretches.`;
    case 'length':
      // A jacket's hem lands against the hip line, where a top's length is scored to end.
      if (z.kind === 'landing') {
        const where = !over && !under ? 'at your hip line' : `${d} ${over ? 'below' : 'above'} your hip line`;
        return `${LANDING_TEXT[z.landing ?? ''] ?? 'Here'}: the hem ends ${where}.`;
      }
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
    case 'shoulder':
      if (over) return `Shoulder seams sit ${d} wider than your shoulders.`;
      if (under) return `Shoulder seams sit ${d} narrower than your shoulders.`;
      return 'Shoulder seams sit right on your shoulders.';
    case 'walkingRoom':
      if (z.diffCm < 0) return `${d} short of a full stride at the hem: expect shorter steps, or look for a slit.`;
      return `Room for a full stride, with ${d} to spare at the hem.`;
  }
}

/**
 * Where a worked-out body number was taken, after "You 84.1 cm": the waist of a
 * jean is where its band sits; a knit's centre-back length and sleeve start at the back neck.
 */
export function bodyPlaceText(z: ZoneFit, over?: WornOver): string {
  if (z.bodyAt === 'over_layer') return over ? ` with your ${TYPE_NOUN[over.type]} under it` : ' with what’s under it';
  if (z.bodyAt === 'band') return ' where the waistband sits';
  if (z.bodyAt === 'centre_back') return z.zone === 'sleeve' ? ' from the centre of your back to the wrist' : ' from the back of your neck';
  if (z.bodyAt === 'knee') return z.zone === 'inseam' ? ' from your crotch to your knee' : ' from the waistband to your knee';
  if (z.bodyAt === 'shoulder_knee') return ' from your shoulder to your knee';
  if (z.bodyAt === 'ankle') return ' from your crotch to your ankle bone';
  if (z.bodyAt === 'stride') return ' round both legs mid-stride, at the hem';
  if (z.bodyAt === 'hip_point') return ' where the chart measures the hips';
  return '';
}

/** What to call a garment of each type in a sentence: "your hoodie", "the jacket". */
const TYPE_NOUN: Record<GarmentType, string> = {
  tee: 'tee',
  'long-sleeve-tee': 'long-sleeve tee',
  polo: 'polo',
  'button-up': 'shirt',
  hoodie: 'hoodie',
  sweatshirt: 'sweatshirt',
  sweater: 'sweater',
  cardigan: 'cardigan',
  jeans: 'jeans',
  chinos: 'chinos',
  joggers: 'joggers',
  trousers: 'trousers',
  shorts: 'shorts',
  skirt: 'skirt',
  jacket: 'jacket',
  coat: 'coat',
  dress: 'dress',
  leggings: 'leggings',
};

/** A fit worked out over a layer says so: "With your hoodie under it". null for a bare-body fit. */
export function wornOverText(fit: Pick<GarmentFit, 'over'>): string | null {
  return fit.over ? `With your ${TYPE_NOUN[fit.over.type]} under it` : null;
}

/** One note on how two layers sit together. */
export function layerNoteText(note: LayerNote, under: GarmentType, outer: GarmentType, units: UnitSystem): string {
  const u = TYPE_NOUN[under];
  const o = TYPE_NOUN[outer];
  switch (note.kind) {
    case 'hem-shows':
      return `Your ${u} shows ${formatLength(note.cm, units)} below the ${o}’s hem.`;
    case 'cuffs-show':
      return `Your ${u}’s cuffs show past the ${o}’s sleeves.`;
    case 'bunches':
      return `Your ${u} is roomier than the ${o} leaves room for: expect it to bunch up underneath.`;
  }
}

/** Every note on how a jacket sits over the top under it, worded. Empty without a layer. */
export function layerNoteLines(body: BodyModel, under: UnderLayer | undefined, outer: UnderLayer, units: UnitSystem): string[] {
  if (!under) return [];
  const worn = under.garment.category === 'onepiece' ? { onepiece: under, outer } : { top: under, outer };
  return fitOutfit(body, worn).notes.map((n) => layerNoteText(n, under.garment.type, outer.garment.type, units));
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
  'mid-thigh': 'Mid-thigh',
  'above-knee': 'Above the knee',
  knee: 'At the knee',
  mini: 'Mini',
  midi: 'Midi',
  maxi: 'Maxi',
  restricted: 'Short steps',
  free: 'Full stride',
  cropped: 'Cropped',
  hip: 'Hip length',
  thigh: 'Thigh length',
  'knee-length': 'Knee length',
  calf: 'Calf length',
  capri: 'Capri',
  '7/8': '7/8 length',
  ankle: 'Ankle length',
  stacked: 'Long',
};

/**
 * A zone's short label for the readout: the objective label for girths and
 * lengths, where it lands for a landing zone, and what goes wrong when one blocks.
 */
export function zoneLabelText(z: ZoneFit, template?: TemplateId): string {
  if (z.kind === 'landing') {
    if (z.label === 'tight') return 'Won’t go on';
    if (z.label === 'short') return 'Won’t stay up';
    if (z.label === 'noted' && z.landing) return LANDING_TEXT[z.landing] ?? LABEL_TEXT.noted;
  }
  if (template === 'leggings' && z.kind === 'girth') return LEGGINGS_LABEL_TEXT[z.label] ?? LABEL_TEXT[z.label];
  return LABEL_TEXT[z.label];
}

export interface FitSummary {
  headline: string;
  detail: string | null;
  /** True when any scored zone relied on an estimated body measurement. */
  usesEstimates: boolean;
}

export function summarize(fit: GarmentFit, template?: TemplateId): FitSummary {
  const scored = fit.zones.filter((z) => z.diffCm !== null);
  const usesEstimates = scored.some((z) => z.bodySource === 'estimated');
  const problems = fit.zones.filter((z) => z.tone === fit.overall && z.tone !== 'good');
  const detail =
    problems.length > 0
      ? sentence(problems.map((z) => `${zoneLabelText(z, template).toLowerCase()} ${zonePlace(z.zone, fit.bodyType)}`))
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
export function sourceLine(garment: Pick<Garment, 'source' | 'stretchAssumed'>): string {
  const { tier, capturedOn } = garment.source;
  const from = tier ? `From ${TIER_PLAIN[tier]}` : 'From the brand’s size chart';
  const stretch = garment.stretchAssumed ? ' Stretch assumed: the chart gives none.' : '';
  return `${from}${capturedOn ? `, copied ${formatCapturedOn(capturedOn)}` : ''}.${stretch}`;
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

/**
 * Whether a garment is worded without the user's preference ("fits well"):
 * bottoms and dresses have no personal target yet (templateZones' `personal`
 * is null for exactly these). Tops and jackets carry it.
 */
export const objectiveOnly = (garment: Pick<Garment, 'category'>): boolean =>
  garment.category === 'bottom' || garment.category === 'onepiece';

function phraseFor(verdict: Exclude<Verdict, 'unknown'>, garment: Pick<Garment, 'category' | 'fitIntent'>): Phrase {
  if (verdict === 'as-designed') {
    const word = INTENT_WORD[garment.fitIntent];
    return { plain: `${word}, as designed`, might: `Might be ${word}, as designed` };
  }
  // Tops and jackets carry the user's preference; bottoms and dresses don't yet.
  return (objectiveOnly(garment) ? BOTTOM_PHRASE : TOP_PHRASE)[verdict];
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
  /** The headline is "Could go either way: M or L": it names the sizes itself. */
  closeCall: boolean;
}

/** The size to name after a headline ("… in M"), or null when the headline already names sizes. */
export function headlineSize(line: VerdictLine, sizeLabel: string): string | null {
  return line.closeCall ? null : sizeLabel;
}

const KNOWN_VERDICTS = VERDICTS.filter((v): v is Exclude<Verdict, 'unknown'> => v !== 'unknown');

/** A size's likeliest verdict, or null when the size is missing or mostly can't be checked. */
function likeliestVerdict(odds: GarmentOdds, sizeLabel: string): { size: SizeOdds; modal: Exclude<Verdict, 'unknown'> } | null {
  const size = odds.sizes.find((s) => s.sizeLabel === sizeLabel);
  if (!size || size.verdicts.unknown >= 0.5) return null;
  const modal = KNOWN_VERDICTS.reduce((best, v) => (size.verdicts[v] > size.verdicts[best] ? v : best), KNOWN_VERDICTS[0]!);
  return { size, modal };
}

/**
 * The colour for one size (its chip's dot): the tone of its likeliest verdict,
 * as `verdictLine` colours it, but never the close call's warn, which is about
 * choosing between two sizes, not about this one.
 */
export function sizeTone(odds: GarmentOdds, sizeLabel: string): FitTone {
  const likeliest = likeliestVerdict(odds, sizeLabel);
  return likeliest ? VERDICT_TONE[likeliest.modal] : 'unknown';
}

/**
 * The headline for one size: the most likely verdict, worded by how sure we are,
 * or "Could go either way: M or L" when this size and another are close.
 */
export function verdictLine(odds: GarmentOdds, sizeLabel: string, garment: Pick<Garment, 'category' | 'fitIntent'>): VerdictLine {
  const likeliest = likeliestVerdict(odds, sizeLabel);
  if (!likeliest) {
    return { headline: 'Can’t check this fit', detail: null, tone: 'unknown', verdict: 'unknown', closeCall: false };
  }
  const { size, modal } = likeliest;
  const liked = objectiveOnly(garment) ? 'fits well' : 'fits how you like';
  const detail = `${formatPercent(size.likes)} chance it ${liked}.`;

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
    return { headline: `Could go either way: ${pair[0]} or ${pair[1]}`, detail, tone: 'warn', verdict: modal, closeCall: true };
  }

  const p = size.verdicts[modal];
  const phrase = phraseFor(modal, garment);
  const headline =
    p >= CERTAINTY.veryLikely ? `Very likely ${phrase.plain}` : p >= CERTAINTY.probably ? `Probably ${phrase.plain}` : phrase.might;
  return { headline, detail, tone: VERDICT_TONE[modal], verdict: modal, closeCall: false };
}

/** The Fitting room's answer: a headline and one line under it. */
export interface FittingHeadline {
  headline: string;
  /** The selected size's verdict, naming that size when it isn't the suggested one. */
  line: string;
  tone: FitTone;
}

/**
 * "M fits you", then the selected size's verdict headline under it ("Showing L: Probably
 * roomy" when L isn't the suggested size). With no suggested size, the size line's
 * fallback ("Size M · we couldn’t pick one for you") heads it instead.
 */
export function fittingHeadline(recommended: string | null, sizeLabel: string, verdict: VerdictLine): FittingHeadline {
  const tone = verdict.tone;
  if (!recommended) return { headline: sizeLine(sizeLabel, false), line: verdict.headline, tone };
  const line = sizeLabel === recommended ? verdict.headline : `Showing ${sizeLabel}: ${verdict.headline}`;
  return { headline: `${recommended} fits you`, line, tone };
}

const MEASURE_NAME: Record<MeasurableKey, string> = {
  chestCm: 'chest',
  waistCm: 'waist',
  hipsCm: 'hips',
  inseamCm: 'inseam',
};

/** The hinted measurement's name for this body: "chest", or "bust" for a women's body. */
function measureName(hint: MeasureHint, bodyType: BodyType): string {
  return hint.key === 'chestCm' && bodyType === 'womens' ? 'bust' : MEASURE_NAME[hint.key];
}

/** "Measure your chest to decide between M and L." ("bust" for a women's body) */
export function measureHintText(hint: MeasureHint, bodyType: BodyType = 'mens'): string {
  return `Measure your ${measureName(hint, bodyType)} to decide between ${listOf(hint.sizes)}.`;
}

/** The hint's button: "Add chest" ("Add bust" for a women's body). */
export function measureHintAction(hint: MeasureHint, bodyType: BodyType = 'mens'): string {
  return `Add ${measureName(hint, bodyType)}`;
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
  if (!words || objectiveOnly(garment) || z.kind === 'landing') return null;
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
