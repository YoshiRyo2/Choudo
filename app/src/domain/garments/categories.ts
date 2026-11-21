/**
 * Garment templates: what kind of garment each type is, and the data rules that
 * go with it. A new category is mostly a new entry here (data checks, landmarks)
 * plus its zones in domain/fit/zones.ts — not new branches in the engine.
 *
 * See docs/clothing-categories-design.md §2. Only the templates the seed uses
 * today exist; hoodies, skirts, jackets and the rest come with their own PRs.
 */

import type {
  GarmentCategory,
  GarmentImage,
  GarmentWeight,
  GirthKey,
  GarmentType,
  LandmarkName,
  LengthDefinition,
  MeasurementKey,
  PantsLandmarkName,
  SizeMeasurements,
  SleeveDefinition,
  TopLandmarkName,
} from './types';
import { KNIT_OPTIONAL_LANDMARKS, PANTS_LANDMARKS, TOP_LANDMARKS } from './types';
import {
  BOTTOM_RANGES,
  DRESS_LENGTH_RANGES,
  DRESS_RANGES,
  DRESS_SLEEVE_RANGES,
  JACKET_LENGTH_RANGES,
  JACKET_RANGES,
  JACKET_SLEEVE_RANGES,
  KNIT_GIRTH_METHOD_LIMITS,
  KNIT_LENGTH_RANGES,
  KNIT_RANGES,
  KNIT_SLEEVE_RANGES,
  MAX_THIGH_TO_HIPS,
  SHORTS_RANGES,
  SKIRT_RANGES,
  TOP_LENGTH_RANGES,
  TOP_RANGES,
  TOP_SLEEVE_RANGES,
  type Range,
} from './verifyRules';

/** A check between two measurements of one size (cm, full circumference). Breaking it is a warning. */
export interface Relation {
  /** Which measurements it needs; the check is skipped unless the size has both. */
  keys: readonly [MeasurementKey, MeasurementKey];
  holds: (m: Required<Pick<SizeMeasurements, MeasurementKey>>) => boolean;
  /** The warning, for a size label and the two values. */
  message: (label: string, a: string, b: string) => string;
}

/** The template a garment type is fitted, checked and drawn with. */
export type TemplateId = 'tee' | 'shirt' | 'knit' | 'pants' | 'shorts' | 'skirt' | 'jacket' | 'dress';

export const TYPE_TEMPLATE: Record<GarmentType, TemplateId> = {
  tee: 'tee',
  'long-sleeve-tee': 'tee',
  polo: 'tee',
  'button-up': 'shirt',
  jeans: 'pants',
  chinos: 'pants',
  joggers: 'pants',
  trousers: 'pants',
  shorts: 'shorts',
  skirt: 'skirt',
  hoodie: 'knit',
  sweatshirt: 'knit',
  sweater: 'knit',
  cardigan: 'knit',
  jacket: 'jacket',
  coat: 'jacket',
  dress: 'dress',
};

export const GARMENT_TYPES = Object.keys(TYPE_TEMPLATE) as GarmentType[];

/** `data:check` rules for one template. Thresholds stay in verifyRules.ts. */
export interface CategoryChecks {
  /** Without these the garment says nothing useful: every size must have them. */
  required: readonly MeasurementKey[];
  /** Plausible values, cm, full circumference. Outside = warning. */
  ranges: Partial<Record<MeasurementKey, Range>>;
  /** Top length (from the high point of the shoulder) by garment type. */
  lengthRanges?: Partial<Record<GarmentType, Range>>;
  /** Where this template's girths differ from GIRTH_METHOD_LIMITS (knits run bigger). */
  girthMethodLimits?: Partial<Record<GirthKey, { flatMax: number; circumferenceMin: number }>>;
  /** Long sleeves by where they're measured from; a definition not listed isn't range-checked. */
  sleeveRanges?: Partial<Record<SleeveDefinition, Range>>;
  /** Ease against a typical body for the size label: the chest for letter-sized tops, the waist for pants sized in inches. */
  labelEase: 'chest' | 'waist' | null;
  /** Checks between measurements of one size (pants: opening ≤ knee ≤ thigh). */
  relations?: readonly Relation[];
}

const PANTS_RELATIONS: readonly Relation[] = [
  {
    keys: ['legOpening', 'knee'],
    holds: (m) => m.legOpening <= m.knee,
    message: (label, a, b) => `legOpening in ${label} (${a}) is wider than its knee (${b})`,
  },
  {
    keys: ['knee', 'thigh'],
    holds: (m) => m.knee <= m.thigh,
    message: (label, a, b) => `knee in ${label} (${a}) is wider than its thigh (${b})`,
  },
  {
    keys: ['thigh', 'hips'],
    holds: (m) => m.thigh <= MAX_THIGH_TO_HIPS * m.hips,
    message: (label, a, b) => `thigh in ${label} (${a}) is more than ${MAX_THIGH_TO_HIPS} × its hips (${b})`,
  },
];

const SHORTS_RELATIONS: readonly Relation[] = [
  {
    keys: ['legOpening', 'thigh'],
    holds: (m) => m.legOpening <= m.thigh,
    message: (label, a, b) => `legOpening in ${label} (${a}) is wider than its thigh (${b})`,
  },
  PANTS_RELATIONS[2]!,
];

const SKIRT_RELATIONS: readonly Relation[] = [
  {
    keys: ['waist', 'hips'],
    holds: (m) => m.waist <= m.hips,
    message: (label, a, b) => `waist in ${label} (${a}) is wider than its hips (${b})`,
  },
];

export interface CategorySpec {
  template: TemplateId;
  /** The category (outfit slot) every type of this template belongs to. */
  category: GarmentCategory;
  /** Whether rows must say short or long sleeve (tops), or must not (bottoms). */
  sleeve: 'required' | 'forbidden';
  /** Whether rows must give a length definition (tops, skirts), or must not (pants and shorts have no length but the inseam). */
  lengthDefinition: 'required' | 'forbidden';
  /** With a required length definition: the values a row may give. */
  lengthDefinitions?: readonly LengthDefinition[];
  /** Photo landmark names, or null when this template can't take a photo texture yet. */
  landmarks: readonly LandmarkName[] | null;
  /** Landmarks a photo may add (a knit's hoodTop); checked when given, never required. */
  optionalLandmarks?: readonly LandmarkName[];
  /** Fabric bulk when a row doesn't give its weight (design §3: tee and shirt light, knit mid). */
  defaultWeight: GarmentWeight;
  /**
   * Tops: the length and sleeve definitions the fit can score (as the zones'
   * `needs` in domain/fit/zones.ts). Any other leaves that zone unscored.
   */
  scoredDefinitions?: { length: readonly LengthDefinition[]; sleeve: readonly SleeveDefinition[] };
  checks: CategoryChecks;
}

const TOP_CHECKS: CategoryChecks = {
  required: ['chest', 'length'],
  ranges: TOP_RANGES,
  lengthRanges: TOP_LENGTH_RANGES,
  sleeveRanges: TOP_SLEEVE_RANGES,
  labelEase: 'chest',
};

const KNIT_RELATIONS: readonly Relation[] = [
  {
    keys: ['hemBand', 'chest'],
    holds: (m) => m.hemBand <= m.chest,
    message: (label, a, b) => `hemBand in ${label} (${a}) is wider than its chest (${b})`,
  },
];

const KNIT_CHECKS: CategoryChecks = {
  required: ['chest', 'length'],
  ranges: KNIT_RANGES,
  lengthRanges: KNIT_LENGTH_RANGES,
  sleeveRanges: KNIT_SLEEVE_RANGES,
  girthMethodLimits: KNIT_GIRTH_METHOD_LIMITS,
  labelEase: 'chest',
  relations: KNIT_RELATIONS,
};

const TOP_SPEC = {
  category: 'top',
  sleeve: 'required',
  lengthDefinition: 'required',
  lengthDefinitions: ['hps', 'center_back', 'unknown'],
  landmarks: TOP_LANDMARKS,
  checks: TOP_CHECKS,
  defaultWeight: 'light',
  scoredDefinitions: { length: ['hps'], sleeve: ['shoulder_to_cuff'] },
} as const satisfies Omit<CategorySpec, 'template'>;

// A dress: the top's checks for the bust, length and sleeve, the skirt's for the waist and hips.
const DRESS_SPEC: CategorySpec = {
  template: 'dress',
  category: 'onepiece',
  sleeve: 'required',
  lengthDefinition: 'required',
  // Dress length runs from the shoulder, as a top's (domain/fit/dress.ts places the hem from it).
  lengthDefinitions: ['hps', 'center_back', 'unknown'],
  scoredDefinitions: { length: ['hps', 'center_back'], sleeve: ['shoulder_to_cuff', 'center_back_to_cuff'] },
  // No dress photos yet.
  landmarks: null,
  checks: {
    required: ['chest', 'length'],
    ranges: DRESS_RANGES,
    lengthRanges: { dress: DRESS_LENGTH_RANGES },
    sleeveRanges: DRESS_SLEEVE_RANGES,
    // The typical-chest table is a tee's; a dress's bust is cut with its own ease.
    labelEase: null,
    relations: SKIRT_RELATIONS,
  },
  defaultWeight: 'light',
};

export const CATEGORY_SPECS: Record<TemplateId, CategorySpec> = {
  tee: { template: 'tee', ...TOP_SPEC },
  shirt: { template: 'shirt', ...TOP_SPEC },
  // Worn in the top slot until jackets bring layers (design §6, PR 4).
  knit: {
    template: 'knit',
    ...TOP_SPEC,
    checks: KNIT_CHECKS,
    optionalLandmarks: KNIT_OPTIONAL_LANDMARKS,
    defaultWeight: 'mid',
    // Knit charts often measure from the centre back (domain/fit/tops.ts converts).
    scoredDefinitions: { length: ['hps', 'center_back'], sleeve: ['shoulder_to_cuff', 'center_back_to_cuff'] },
  },
  pants: {
    template: 'pants',
    category: 'bottom',
    sleeve: 'forbidden',
    lengthDefinition: 'forbidden',
    landmarks: PANTS_LANDMARKS,
    checks: { required: ['waist', 'inseam'], ranges: BOTTOM_RANGES, labelEase: 'waist', relations: PANTS_RELATIONS },
    defaultWeight: 'mid',
  },
  // The pants template cut short: no knee, and the hem lands on the thigh (domain/fit/zones.ts).
  shorts: {
    template: 'shorts',
    category: 'bottom',
    sleeve: 'forbidden',
    lengthDefinition: 'forbidden',
    // No shorts photos yet; the pants landmarks have knees that shorts don't.
    landmarks: null,
    checks: { required: ['waist', 'inseam'], ranges: SHORTS_RANGES, labelEase: 'waist', relations: SHORTS_RELATIONS },
    defaultWeight: 'light',
  },
  skirt: {
    template: 'skirt',
    category: 'bottom',
    sleeve: 'forbidden',
    // Skirt length runs from the top of the waistband (domain/fit/skirt.ts places the hem from the band).
    lengthDefinition: 'required',
    lengthDefinitions: ['waist', 'unknown'],
    scoredDefinitions: { length: ['waist'], sleeve: [] },
    // No skirt photos yet.
    landmarks: null,
    checks: { required: ['waist', 'length'], ranges: SKIRT_RANGES, labelEase: null, relations: SKIRT_RELATIONS },
    defaultWeight: 'light',
  },
  // Worn over the top (outer slot); fitted over what's under it (domain/fit/layers.ts).
  jacket: {
    template: 'jacket',
    ...TOP_SPEC,
    category: 'outer',
    checks: {
      required: ['chest', 'length'],
      ranges: JACKET_RANGES,
      lengthRanges: JACKET_LENGTH_RANGES,
      sleeveRanges: JACKET_SLEEVE_RANGES,
      // Flat chests run as big as a knit's (a 6XL soft shell is 35½ in flat).
      girthMethodLimits: KNIT_GIRTH_METHOD_LIMITS,
      // The typical-chest table is a tee's; a jacket's chest carries its own offset.
      labelEase: null,
      relations: [],
    },
    landmarks: null,
    defaultWeight: 'mid',
    scoredDefinitions: { length: ['hps', 'center_back'], sleeve: ['shoulder_to_cuff', 'center_back_to_cuff'] },
  },
  dress: DRESS_SPEC,
};

export const isGarmentType = (type: unknown): type is GarmentType =>
  typeof type === 'string' && Object.prototype.hasOwnProperty.call(TYPE_TEMPLATE, type);

/** The template for a garment (seed row or normalized). Assumes a known type (validateGarment checks it). */
export const templateOf = (g: { type: GarmentType }): TemplateId => TYPE_TEMPLATE[g.type];

export const categorySpec = (g: { type: GarmentType }): CategorySpec => CATEGORY_SPECS[templateOf(g)];

/** A garment's fabric bulk: the row's own, or its template's default. */
export const weightOf = (g: { type: GarmentType; weight?: GarmentWeight }): GarmentWeight =>
  g.weight ?? categorySpec(g).defaultWeight;

type Point = { x: number; y: number };

/** A photo's landmarks as a complete set of these names, or null when any is missing. */
function landmarkSet<N extends LandmarkName>(image: Pick<GarmentImage, 'landmarks'>, names: readonly N[]): Record<N, Point> | null {
  const out = {} as Record<N, Point>;
  for (const n of names) {
    const p = image.landmarks[n];
    if (!p) return null;
    out[n] = p;
  }
  return out;
}

/** A top photo's 13 landmarks, or null when it isn't a complete top set. */
export const topLandmarks = (image: Pick<GarmentImage, 'landmarks'>): Record<TopLandmarkName, Point> | null =>
  landmarkSet(image, TOP_LANDMARKS);

/** A pants photo's 14 landmarks, or null when it isn't a complete pants set. */
export const pantsLandmarks = (image: Pick<GarmentImage, 'landmarks'>): Record<PantsLandmarkName, Point> | null =>
  landmarkSet(image, PANTS_LANDMARKS);
