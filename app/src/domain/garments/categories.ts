/**
 * Garment templates: what kind of garment each type is, and the data rules that
 * go with it. A new category is mostly a new entry here (data checks, landmarks)
 * plus its zones in domain/fit/zones.ts — not new branches in the engine.
 *
 * See docs/clothing-categories-design.md §2. Only the templates the seed uses
 * today exist; hoodies, skirts, jackets and the rest come with their own PRs.
 */

import type { GarmentCategory, GarmentType, MeasurementKey, TopLandmarkName } from './types';
import { TOP_LANDMARKS } from './types';
import { BOTTOM_RANGES, TOP_LENGTH_RANGES, TOP_RANGES, type Range } from './verifyRules';

/** The template a garment type is fitted, checked and drawn with. */
export type TemplateId = 'tee' | 'shirt' | 'pants';

export const TYPE_TEMPLATE: Record<GarmentType, TemplateId> = {
  tee: 'tee',
  'long-sleeve-tee': 'tee',
  polo: 'tee',
  'button-up': 'shirt',
  jeans: 'pants',
  chinos: 'pants',
  joggers: 'pants',
  trousers: 'pants',
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
  /** Ease against a typical body for the size label: the chest for letter-sized tops, the waist for pants sized in inches. */
  labelEase: 'chest' | 'waist' | null;
}

export interface CategorySpec {
  template: TemplateId;
  /** The category (outfit slot) every type of this template belongs to. */
  category: GarmentCategory;
  /** Whether rows must say short or long sleeve (tops), or must not (bottoms). */
  sleeve: 'required' | 'forbidden';
  /** Whether rows must give chart.lengthDefinition (tops), or must not (bottoms have no top length). */
  lengthDefinition: 'required' | 'forbidden';
  /** Photo landmark names, or null when this template can't take a photo texture yet. */
  landmarks: readonly TopLandmarkName[] | null;
  checks: CategoryChecks;
}

const TOP_CHECKS: CategoryChecks = {
  required: ['chest', 'length'],
  ranges: TOP_RANGES,
  lengthRanges: TOP_LENGTH_RANGES,
  labelEase: 'chest',
};

const TOP_SPEC = {
  category: 'top',
  sleeve: 'required',
  lengthDefinition: 'required',
  landmarks: TOP_LANDMARKS,
  checks: TOP_CHECKS,
} as const satisfies Omit<CategorySpec, 'template'>;

export const CATEGORY_SPECS: Record<TemplateId, CategorySpec> = {
  tee: { template: 'tee', ...TOP_SPEC },
  shirt: { template: 'shirt', ...TOP_SPEC },
  pants: {
    template: 'pants',
    category: 'bottom',
    sleeve: 'forbidden',
    lengthDefinition: 'forbidden',
    landmarks: null,
    checks: { required: ['waist', 'inseam'], ranges: BOTTOM_RANGES, labelEase: 'waist' },
  },
};

export const isGarmentType = (type: unknown): type is GarmentType =>
  typeof type === 'string' && Object.prototype.hasOwnProperty.call(TYPE_TEMPLATE, type);

/** The template for a garment (seed row or normalized). Assumes a known type (validateGarment checks it). */
export const templateOf = (g: { type: GarmentType }): TemplateId => TYPE_TEMPLATE[g.type];

export const categorySpec = (g: { type: GarmentType }): CategorySpec => CATEGORY_SPECS[templateOf(g)];
