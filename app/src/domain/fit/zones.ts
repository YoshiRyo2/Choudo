/**
 * Which zones each garment template is fitted on, and with which rule.
 *
 * The fit engine, the sampler and the personal verdict read this table instead
 * of switching on tops and bottoms, so a new category is a new entry here (and
 * in garments/categories.ts). See docs/clothing-categories-design.md §2.3.
 */

import type { BodyMeasurements, MeasurementKey as BodyKey } from '../body';
import {
  stretchOf,
  templateOf,
  type DefinitionName,
  type Garment,
  type GarmentSizing,
  type SizeMeasurements,
  type TemplateId,
} from '../garments';
import {
  BOTTOM_HIPS,
  BOTTOM_WAIST,
  INSEAM,
  LEG_OPENING,
  RISE,
  SLEEVE,
  THIGH,
  TOP_GIRTH_RULES,
  TOP_LENGTH,
  type GirthRule,
  type LandingRule,
  type LengthRule,
} from './rules';
import { bandHeight, girthAtHeight, riseForBand } from './pants';

export type ZoneId = 'chest' | 'waist' | 'hips' | 'length' | 'sleeve' | 'inseam' | 'thigh' | 'rise' | 'legOpening';

export type Rule = GirthRule | LengthRule | LandingRule;

/** One rule for everyone, or one per garment sizing (tops' chest and waist). */
export type ZoneRule = Rule | { bySizing: Record<GarmentSizing, Rule> };

/**
 * A definition the zone can't be scored without. Any other value (or none)
 * makes the zone "unknown", with `reason` as the note.
 */
export interface ZoneNeeds {
  definition: DefinitionName;
  accepts: readonly string[];
  reason: (brand: string, value: string | undefined) => string;
}

export interface ZoneSpec {
  zone: ZoneId;
  garmentKey: keyof SizeMeasurements;
  bodyKey: BodyKey;
  rule: ZoneRule;
  /**
   * The body number to compare with, when it's worked out rather than read off
   * (the waist at the height the band sits). `bodyKey` still gives its source.
   */
  bodyTarget?: (m: BodyMeasurements, garment: Garment, size: SizeMeasurements) => number;
  /**
   * The size's overall result doesn't need this zone: when it can't be scored the
   * size isn't "unknown" because of it (a pants chart without a thigh).
   */
  optional?: true;
  /** When the zone is scored at all. Leave out for "always". */
  applies?: (garment: Garment, size: SizeMeasurements) => boolean;
  needs?: ZoneNeeds;
}

export interface TemplateZones {
  template: TemplateId;
  /** In the order results are reported. */
  zones: readonly ZoneSpec[];
  /**
   * The zones the user's preference speaks to: a girth (target ease) and a length
   * (an anchor's length). null = objective labels only (pants have no personal target yet).
   */
  personal: { girth: ZoneId; length: ZoneId } | null;
}

/** Body measurements a user can type in on the body screen. */
export const MEASURABLE_BODY_KEYS = ['chestCm', 'waistCm', 'hipsCm', 'inseamCm'] as const;
export type MeasurableKey = (typeof MEASURABLE_BODY_KEYS)[number];

const bySizing = (pick: (rules: (typeof TOP_GIRTH_RULES)[GarmentSizing]) => Rule): ZoneRule => ({
  bySizing: {
    mens: pick(TOP_GIRTH_RULES.mens),
    unisex: pick(TOP_GIRTH_RULES.unisex),
    womens: pick(TOP_GIRTH_RULES.womens),
  },
});

const TOP_ZONES: readonly ZoneSpec[] = [
  { zone: 'chest', garmentKey: 'chest', bodyKey: 'chestCm', rule: bySizing((r) => r.chest) },
  // Button-ups list a waist; tees don't.
  {
    zone: 'waist',
    garmentKey: 'waist',
    bodyKey: 'waistCm',
    rule: bySizing((r) => r.waist),
    applies: (_g, size) => size.waist !== undefined,
  },
  {
    zone: 'length',
    garmentKey: 'length',
    bodyKey: 'torsoLengthCm',
    rule: TOP_LENGTH,
    // Body length targets run from the high point of the shoulder; any other start point can't be compared.
    needs: {
      definition: 'length',
      accepts: ['hps'],
      reason: (brand, value) =>
        value === 'center_back'
          ? `${brand} measures length from the back of the neck, so we can't compare it to your body.`
          : `${brand}'s chart doesn't say where length is measured from.`,
    },
  },
  {
    zone: 'sleeve',
    garmentKey: 'sleeve',
    bodyKey: 'armLengthCm',
    rule: SLEEVE,
    // Short sleeves are a style choice, not a fit issue, so we only score long sleeves.
    applies: (g) => g.sleeve === 'long',
    needs: {
      definition: 'sleeve',
      accepts: ['shoulder_to_cuff'],
      reason: (brand) => `${brand} measures sleeves differently, so we can't compare it to your arm.`,
    },
  },
];

const PANTS_ZONES: readonly ZoneSpec[] = [
  // Compared where the band sits: lower on the body for a lower rise (fit/pants.ts).
  {
    zone: 'waist',
    garmentKey: 'waist',
    bodyKey: 'waistCm',
    rule: BOTTOM_WAIST,
    bodyTarget: (m, g, s) => girthAtHeight(m, bandHeight(m, riseForBand(g, s))),
  },
  { zone: 'hips', garmentKey: 'hips', bodyKey: 'hipsCm', rule: BOTTOM_HIPS },
  {
    zone: 'thigh',
    garmentKey: 'thigh',
    bodyKey: 'thighCm',
    rule: THIGH,
    optional: true,
    needs: {
      definition: 'thigh',
      accepts: ['at_crotch', 'below_crotch_2_5cm'],
      reason: (brand) => `${brand}'s chart doesn't say where the thigh is measured.`,
    },
  },
  {
    zone: 'rise',
    garmentKey: 'rise',
    bodyKey: 'frontRiseCm',
    optional: true,
    rule: {
      ...RISE,
      // The only way a rise makes a size bad: the band would sit below the hip line.
      blocks: ({ body, garmentCm }) =>
        bandHeight(body, garmentCm) < body.hipHeightCm
          ? { label: 'short', note: 'The waistband would sit below your hips, so it won’t stay up.' }
          : null,
    },
    needs: {
      definition: 'rise',
      accepts: ['front'],
      reason: (brand) => `${brand} doesn't say this is the front rise, so we can't place the waistband.`,
    },
  },
  { zone: 'inseam', garmentKey: 'inseam', bodyKey: 'inseamCm', rule: INSEAM },
  {
    zone: 'legOpening',
    garmentKey: 'legOpening',
    bodyKey: 'heelAnkleCm',
    optional: true,
    rule: {
      ...LEG_OPENING,
      // Without stretch or a zip, an opening smaller than the heel won't go on.
      blocks: ({ body, garment, garmentCm }) =>
        stretchOf(garment, 'legOpening') === 'none' && !garment.ankleZip && garmentCm < body.heelAnkleCm
          ? { label: 'tight', note: 'Too narrow to get over your heel: no stretch and no zip.' }
          : null,
    },
  },
];

const TOP_PERSONAL = { girth: 'chest', length: 'length' } as const;

export const TEMPLATE_ZONES: Record<TemplateId, TemplateZones> = {
  tee: { template: 'tee', zones: TOP_ZONES, personal: TOP_PERSONAL },
  shirt: { template: 'shirt', zones: TOP_ZONES, personal: TOP_PERSONAL },
  pants: { template: 'pants', zones: PANTS_ZONES, personal: null },
};

export const templateZones = (g: Pick<Garment, 'type'>): TemplateZones => TEMPLATE_ZONES[templateOf(g)];

/** The zones this size of this garment is scored on, in report order. */
export function zoneSpecsFor(garment: Garment, size: SizeMeasurements): ZoneSpec[] {
  return templateZones(garment).zones.filter((z) => z.applies?.(garment, size) ?? true);
}

/** The rule a zone uses for this garment (by its sizing, where the zone has one rule per sizing). */
export function ruleFor(spec: ZoneSpec, garment: Pick<Garment, 'sizing'>): Rule {
  return 'bySizing' in spec.rule ? spec.rule.bySizing[garment.sizing] : spec.rule;
}

/** The rule for one zone of a garment, or null when its template has no such zone. */
export function zoneRule(garment: Garment, zone: ZoneId): Rule | null {
  const spec = templateZones(garment).zones.find((z) => z.zone === zone);
  return spec ? ruleFor(spec, garment) : null;
}

/**
 * Body measurements the user could type in that change this garment's result:
 * those its zones compare against, for zones that apply to at least one size.
 */
export function measurableKeys(garment: Garment): MeasurableKey[] {
  const keys: MeasurableKey[] = [];
  for (const z of templateZones(garment).zones) {
    const key = z.bodyKey as MeasurableKey;
    if (!MEASURABLE_BODY_KEYS.includes(key) || keys.includes(key)) continue;
    if (garment.sizes.some((s) => z.applies?.(garment, s.measurements) ?? true)) keys.push(key);
  }
  return keys;
}
