/**
 * Which zones each garment template is fitted on, and with which rule.
 *
 * The fit engine, the sampler and the personal verdict read this table instead
 * of switching on tops and bottoms, so a new category is a new entry here (and
 * in garments/categories.ts). See docs/clothing-categories-design.md §2.3.
 */

import type { BodyMeasurements, MeasurementKey as BodyKey } from '../body';
import {
  definitionOf,
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
  DRESS_GIRTH_RULES,
  HEM_BAND,
  INSEAM,
  JACKET_EASE_OFFSET_CM,
  JACKET_GIRTH_RULES,
  JACKET_LENGTH,
  JACKET_SHOULDER,
  KNIT_EASE_OFFSET_CM,
  KNIT_GIRTH_RULES,
  LEG_OPENING,
  RISE,
  SHORTS_INSEAM,
  SKIRT_LENGTH,
  SLEEVE,
  THIGH,
  TOP_GIRTH_RULES,
  TOP_LENGTH,
  WALKING_ROOM,
  type GirthRule,
  type LandingRule,
  type LengthRule,
} from './rules';
import { bandHeight, girthAtHeight, riseForBand } from './pants';
import { crotchToKneeCm } from './shorts';
import { skirtBandHeight, skirtHemHeight, skirtHipHeight, strideGirthCm } from './skirt';
import { lengthTargetCm, sleeveTargetCm, hpsLengthCm } from './tops';
import { dressHemHeight, hpsToKneeCm } from './dress';

export type ZoneId =
  | 'chest'
  | 'waist'
  | 'hips'
  | 'length'
  | 'sleeve'
  | 'inseam'
  | 'thigh'
  | 'rise'
  | 'legOpening'
  | 'hemBand'
  | 'walkingRoom'
  | 'shoulder';

/**
 * Where a worked-out body number was taken: band = the body's girth where a
 * waistband sits; centre_back = a length from the centre of the back neck;
 * knee = a distance down to the knee (where a hem lands against it);
 * hip_point = the body's girth where a skirt chart measures its hips;
 * stride = the girth round both legs mid-stride, at the hem;
 * shoulder_knee = from the high point of the shoulder down to the knee (a dress hem);
 * over_layer = the body plus what is worn under the garment (layers.ts).
 */
export type BodyAt = 'band' | 'centre_back' | 'knee' | 'hip_point' | 'stride' | 'over_layer' | 'shoulder_knee';

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
  /** What a worked-out target is, for the readout (set with bodyTarget). */
  bodyAt?: BodyAt;
  /**
   * The size's overall result doesn't need this zone: when it can't be scored the
   * size isn't "unknown" because of it (a pants chart without a thigh).
   */
  optional?: true;
  /** When the zone is scored at all. Leave out for "always". */
  applies?: (garment: Garment, size: SizeMeasurements) => boolean;
  needs?: ZoneNeeds;
  /**
   * Compared over whatever is worn under the garment (a jacket's chest over a
   * hoodie): the body plus the layer's room (layers.ts). Bare body without one.
   */
  layered?: true;
}

export interface TemplateZones {
  template: TemplateId;
  /** In the order results are reported. */
  zones: readonly ZoneSpec[];
  /**
   * The zones the user's preference speaks to: a girth (target ease) and a length
   * (an anchor's length; null when the template has none to compare, as a jacket's
   * length only lands). null = objective labels only (pants have no personal target yet).
   * easeOffsetCm: how much roomier than a tee this template's chest is aimed (knits, jackets).
   */
  personal: { girth: ZoneId; length: ZoneId | null; easeOffsetCm?: number } | null;
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
    bodyAt: 'band',
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

/**
 * Shorts: the pants waist, hips, thigh and rise as they are; the inseam says where
 * the hem lands against the knee (it isn't meant to reach the ankle), and there's
 * no leg opening zone (pants measure it against the heel).
 */
const SHORTS_ZONES: readonly ZoneSpec[] = [
  ...PANTS_ZONES.filter((z) => z.zone !== 'inseam' && z.zone !== 'legOpening'),
  {
    zone: 'inseam',
    garmentKey: 'inseam',
    bodyKey: 'inseamCm',
    rule: SHORTS_INSEAM,
    bodyTarget: (m) => crotchToKneeCm(m),
    bodyAt: 'knee',
  },
];

/**
 * Skirts: the waist where the band sits, the hips where the chart measures them,
 * where the hem lands against the knee, and whether the hem opens to a stride.
 */
const SKIRT_ZONES: readonly ZoneSpec[] = [
  {
    zone: 'waist',
    garmentKey: 'waist',
    bodyKey: 'waistCm',
    rule: BOTTOM_WAIST,
    bodyTarget: (m, g) => girthAtHeight(m, skirtBandHeight(m, g)),
    bodyAt: 'band',
  },
  {
    zone: 'hips',
    garmentKey: 'hips',
    bodyKey: 'hipsCm',
    rule: BOTTOM_HIPS,
    bodyTarget: (m, g) => (g.hipsBelowWaistCm === undefined ? m.hipsCm : girthAtHeight(m, skirtHipHeight(m, g))),
    bodyAt: 'hip_point',
  },
  {
    zone: 'length',
    garmentKey: 'length',
    bodyKey: 'kneeHeightCm',
    rule: SKIRT_LENGTH,
    // Band to knee: a skirt this long ends at the middle of the kneecap.
    bodyTarget: (m, g) => skirtBandHeight(m, g) - m.kneeHeightCm,
    bodyAt: 'knee',
    needs: {
      definition: 'length',
      accepts: ['waist'],
      reason: (brand) => `${brand}'s chart doesn't say the length runs from the waistband, so we can't place the hem.`,
    },
  },
  {
    zone: 'walkingRoom',
    garmentKey: 'hemSweep',
    bodyKey: 'thighCm',
    rule: WALKING_ROOM,
    optional: true,
    // Needs the hem's height, so only with a length.
    applies: (_g, s) => s.length !== undefined,
    bodyTarget: (m, g, s) => strideGirthCm(m, skirtHemHeight(m, g, s)),
    bodyAt: 'stride',
  },
];

const KNIT_ZONES: readonly ZoneSpec[] = [
  { zone: 'chest', garmentKey: 'chest', bodyKey: 'chestCm', rule: { bySizing: KNIT_GIRTH_RULES } },
  {
    zone: 'length',
    garmentKey: 'length',
    bodyKey: 'torsoLengthCm',
    rule: TOP_LENGTH,
    // Knit charts often measure from the back neck; that's comparable once the back-neck drop is allowed for.
    bodyTarget: (m, g) => lengthTargetCm(m, definitionOf(g, 'length')) ?? m.torsoLengthCm,
    bodyAt: 'centre_back',
    needs: {
      definition: 'length',
      accepts: ['hps', 'center_back'],
      reason: (brand) => `${brand}'s chart doesn't say where length is measured from.`,
    },
  },
  {
    zone: 'sleeve',
    garmentKey: 'sleeve',
    bodyKey: 'armLengthCm',
    rule: SLEEVE,
    applies: (g) => g.sleeve === 'long',
    bodyTarget: (m, g) => sleeveTargetCm(m, definitionOf(g, 'sleeve')) ?? m.armLengthCm,
    bodyAt: 'centre_back',
    needs: {
      definition: 'sleeve',
      accepts: ['shoulder_to_cuff', 'center_back_to_cuff'],
      reason: (brand) => `${brand} measures sleeves differently, so we can't compare it to your arm.`,
    },
  },
  // The rib hem band against the hips (a top's length is scored to end at the hip line). Few charts list it.
  { zone: 'hemBand', garmentKey: 'hemBand', bodyKey: 'hipsCm', rule: HEM_BAND, optional: true },
];

/**
 * Jackets and coats: chest (and a charted waist) over whatever is worn under
 * them, the shoulder seam when charted, the sleeve, and where the hem lands.
 */
const JACKET_ZONES: readonly ZoneSpec[] = [
  { zone: 'chest', garmentKey: 'chest', bodyKey: 'chestCm', rule: { bySizing: JACKET_GIRTH_RULES }, layered: true },
  {
    zone: 'waist',
    garmentKey: 'waist',
    bodyKey: 'waistCm',
    rule: { bySizing: JACKET_GIRTH_RULES },
    applies: (_g, size) => size.waist !== undefined,
    layered: true,
  },
  // Few charts list the shoulder; when they do, the seam should sit on the shoulder point.
  { zone: 'shoulder', garmentKey: 'shoulder', bodyKey: 'shoulderWidthCm', rule: JACKET_SHOULDER, optional: true },
  KNIT_ZONES.find((z) => z.zone === 'sleeve')!,
  {
    zone: 'length',
    garmentKey: 'length',
    bodyKey: 'torsoLengthCm',
    rule: JACKET_LENGTH,
    bodyTarget: (m, g) => lengthTargetCm(m, definitionOf(g, 'length')) ?? m.torsoLengthCm,
    bodyAt: 'centre_back',
    needs: {
      definition: 'length',
      accepts: ['hps', 'center_back'],
      reason: (brand) => `${brand}'s chart doesn't say where length is measured from.`,
    },
  },
];

/**
 * Dresses: the top's bust (and a charted shoulder and long sleeve), the waist at
 * the seam, the hips, where the hem lands against the knee and whether it opens
 * to a stride (the skirt's marks and check). Waist and hips are optional: a
 * fit-and-flare chart often has neither, and an empire seam can't be compared
 * until there's an underbust (PR 6).
 */
const DRESS_ZONES: readonly ZoneSpec[] = [
  { zone: 'chest', garmentKey: 'chest', bodyKey: 'chestCm', rule: DRESS_GIRTH_RULES },
  { ...JACKET_ZONES.find((z) => z.zone === 'shoulder')!, applies: (_g, s) => s.shoulder !== undefined },
  KNIT_ZONES.find((z) => z.zone === 'sleeve')!,
  {
    zone: 'waist',
    garmentKey: 'waist',
    bodyKey: 'waistCm',
    rule: DRESS_GIRTH_RULES,
    optional: true,
    // Like a top's waist, only when the chart lists one.
    applies: (_g, size) => size.waist !== undefined,
    // A natural seam, or a sheath with none, is fitted at the waist: ANSUR II's, at the navel.
    needs: {
      definition: 'waistSeam',
      accepts: ['natural', 'none'],
      reason: (brand, value) =>
        value === 'empire'
          ? `${brand}'s waist seam sits under the bust; we can't compare it until we know your underbust.`
          : value === 'drop'
            ? `${brand}'s waist seam sits below the waist, which we can't place yet.`
            : `${brand}'s chart doesn’t say where the waist seam is.`,
    },
  },
  { zone: 'hips', garmentKey: 'hips', bodyKey: 'hipsCm', rule: BOTTOM_HIPS, optional: true, applies: (_g, size) => size.hips !== undefined },
  {
    zone: 'length',
    garmentKey: 'length',
    bodyKey: 'kneeHeightCm',
    rule: SKIRT_LENGTH,
    // Shoulder to knee: a dress this long (from the high point of the shoulder) ends at the
    // middle of the kneecap. A centre-back length is compared less the back-neck drop.
    bodyTarget: (m, g, s) => hpsToKneeCm(m) - ((hpsLengthCm(g, s) ?? s.length ?? 0) - (s.length ?? 0)),
    bodyAt: 'shoulder_knee',
    needs: {
      definition: 'length',
      accepts: ['hps', 'center_back'],
      reason: (brand) => `${brand}'s chart doesn't say where length is measured from.`,
    },
  },
  {
    zone: 'walkingRoom',
    garmentKey: 'hemSweep',
    bodyKey: 'thighCm',
    rule: WALKING_ROOM,
    optional: true,
    // Needs the hem's height: only with a length we can place (from the shoulder or the centre back).
    applies: (g, s) => hpsLengthCm(g, s) !== undefined,
    bodyTarget: (m, g, s) => strideGirthCm(m, dressHemHeight(m, g, s)),
    bodyAt: 'stride',
  },
];

const TOP_PERSONAL = { girth: 'chest', length: 'length' } as const;

export const TEMPLATE_ZONES: Record<TemplateId, TemplateZones> = {
  tee: { template: 'tee', zones: TOP_ZONES, personal: TOP_PERSONAL },
  shirt: { template: 'shirt', zones: TOP_ZONES, personal: TOP_PERSONAL },
  knit: { template: 'knit', zones: KNIT_ZONES, personal: { ...TOP_PERSONAL, easeOffsetCm: KNIT_EASE_OFFSET_CM } },
  pants: { template: 'pants', zones: PANTS_ZONES, personal: null },
  shorts: { template: 'shorts', zones: SHORTS_ZONES, personal: null },
  skirt: { template: 'skirt', zones: SKIRT_ZONES, personal: null },
  jacket: { template: 'jacket', zones: JACKET_ZONES, personal: { girth: 'chest', length: null, easeOffsetCm: JACKET_EASE_OFFSET_CM } },
  dress: { template: 'dress', zones: DRESS_ZONES, personal: null },
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
