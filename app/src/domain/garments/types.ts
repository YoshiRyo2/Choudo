/**
 * Garment data model.
 *
 * There are two shapes:
 *  - `SeedGarment`: what lives in seed.json. Numbers are copied exactly as the
 *    brand's size chart prints them (inches or cm, flat or full circumference), so
 *    a row can be checked against its source.
 *  - `Garment`: what the rest of the app uses. Every length is cm and every girth
 *    is a full circumference. Produced by `normalizeGarment`.
 */

export type GarmentCategory = 'top' | 'bottom';

export type GarmentType =
  | 'tee'
  | 'long-sleeve-tee'
  | 'polo'
  | 'button-up'
  | 'jeans'
  | 'chinos'
  | 'joggers'
  | 'trousers';

/** Who the size chart is cut for. */
export type GarmentSizing = 'mens' | 'womens' | 'unisex';
export const GARMENT_SIZINGS: readonly GarmentSizing[] = ['mens', 'womens', 'unisex'];

/**
 * How a chart reports girths (chest, waist, hips):
 *  - flat: measured laid flat, side to side — double it for the circumference
 *  - circumference: already the full way round
 *  - unknown: the chart doesn't say. We never guess; girth fit comes back "unknown".
 */
export type GirthMethod = 'flat' | 'circumference' | 'unknown';
export const GIRTH_METHODS: readonly GirthMethod[] = ['flat', 'circumference', 'unknown'];

/** The measurements that are girths (doubled when printed flat). */
export type GirthKey = 'chest' | 'waist' | 'hips';

/**
 * A girth method per measurement, for charts that mix them (pants often print the
 * waist all the way round but the thigh flat). `default` covers every girth not listed.
 */
export type GirthByKey = { default: GirthMethod } & Partial<Record<GirthKey, GirthMethod>>;

/**
 * Where the sleeve is measured from. Only `shoulder_to_cuff` on a long sleeve is
 * compared to the arm; other definitions are kept for reference.
 */
export type SleeveDefinition = 'shoulder_to_cuff' | 'center_back_to_cuff' | 'top_of_sleeve';

/**
 * Where a top's length is measured from:
 *  - hps: high point of shoulder (by the collar) down to the hem — what we compare to the body
 *  - center_back: centre of the back neck down to the hem (a couple of cm shorter)
 *  - unknown: the chart doesn't say. Length then can't be scored.
 */
export type LengthDefinition = 'hps' | 'center_back' | 'unknown';

/** Where a pants rise is measured: front = top of the waistband to the crotch seam, at the front. */
export type RiseDefinition = 'front' | 'back' | 'total' | 'unknown';

/** Where a pants thigh is measured: at the crotch, or a little (2.5 cm, 1 in) below it. */
export type ThighDefinition = 'at_crotch' | 'below_crotch_2_5cm' | 'unknown';

/**
 * Where each measurement is taken, as the chart defines it. A zone that needs a
 * definition is "unknown" without the one it accepts (see domain/fit/zones.ts).
 */
export interface Definitions {
  length?: LengthDefinition;
  sleeve?: SleeveDefinition;
  rise?: RiseDefinition;
  thigh?: ThighDefinition;
}
export type DefinitionName = keyof Definitions;

/** The values each definition may take. */
export const DEFINITION_VALUES: { [K in DefinitionName]-?: readonly NonNullable<Definitions[K]>[] } = {
  length: ['hps', 'center_back', 'unknown'],
  sleeve: ['shoulder_to_cuff', 'center_back_to_cuff', 'top_of_sleeve'],
  rise: ['front', 'back', 'total', 'unknown'],
  thigh: ['at_crotch', 'below_crotch_2_5cm', 'unknown'],
};

/** How the brand means the garment to sit. Used to judge whether its ease is plausible. */
export type FitIntent = 'slim' | 'regular' | 'relaxed' | 'oversized';

/**
 * How trustworthy a garment's source is, best first:
 *  A brand spec sheet · B published garment chart · C partner / print-on-demand API ·
 *  D retailer data · E user-measured garment · F body-size chart only · G photo only.
 */
export type SourceTier = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export const SOURCE_TIERS: readonly SourceTier[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/**
 * Where one number came from:
 *  - chart: copied from the source as printed
 *  - estimated: worked out by us (say, from a neighbouring size) — the source didn't give it
 *  - audited: measured by hand on a real garment
 */
export type MeasurementOrigin = 'chart' | 'estimated' | 'audited';
export const MEASUREMENT_ORIGINS: readonly MeasurementOrigin[] = ['chart', 'estimated', 'audited'];

/**
 * How far to trust a garment's numbers, best first:
 *  - verified: brand / chart / partner source (tier A–C), every check passes, and a real garment was measured
 *  - charted: copied from a chart or retailer (tier A–D), no errors, not (yet) audited
 *  - estimated: some numbers are ours, not the source's — estimated values, invented
 *    placeholder data, or a weak source (tier E–G)
 *  - unscored: a definition the fit needs is unknown, so its key zones can't be scored
 */
export type ConfidenceGrade = 'verified' | 'charted' | 'estimated' | 'unscored';

/**
 * How much the fabric gives. Lets a stretchy garment measure under the body without being "tight".
 * compression: leggings and shapewear, meant to sit well under the body.
 */
export type Stretch = 'none' | 'some' | 'high' | 'compression';
export const STRETCHES: readonly Stretch[] = ['none', 'some', 'high', 'compression'];

/**
 * Stretch per measurement, for garments that give in one place only (a jogger's
 * elastic waist). `default` covers every measurement not listed.
 */
export type StretchByKey = { default: Stretch } & Partial<Record<MeasurementKey, Stretch>>;

/** Measurements for one size. Include only what the chart lists. */
export interface SizeMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  /** Top length: high point of shoulder (by the collar) to hem. */
  length?: number;
  sleeve?: number;
  shoulder?: number;
  inseam?: number;
  rise?: number;
}

export type MeasurementKey = keyof SizeMeasurements;

/** A seed value with its origin spelled out. A plain number means `{ value, origin: "chart" }`. */
export interface MeasuredValue {
  value: number;
  origin: MeasurementOrigin;
  /** For estimated or audited values: how we got the number. */
  how?: string;
}

/** One size as written in seed.json: numbers as printed, in the chart's unit and girth method. */
export interface SeedSize {
  /** As printed on the tag, e.g. "M" or "32x30". */
  label: string;
  measurements: Partial<Record<MeasurementKey, number | MeasuredValue>>;
}

/** Where a normalized number came from, and what we did to it on the way to cm. */
export interface MeasurementProvenance {
  origin: MeasurementOrigin;
  /** The number as written in the seed, in `unit`. */
  printed: number;
  unit: 'cm' | 'in';
  how?: string;
  /** Every conversion applied, in order, e.g. ["flat width doubled", "inches to cm"]. Empty = used as printed. */
  conversions: string[];
}

/** One size, ready for the fit engine: cm, full circumferences. */
export interface GarmentSize {
  label: string;
  measurements: SizeMeasurements;
  provenance: Partial<Record<MeasurementKey, MeasurementProvenance>>;
}

/**
 * Someone measured a real garment laid flat, to check the chart against. Girths are
 * flat widths (we double them), lengths as for the chart.
 */
export interface GarmentAudit {
  /** Which size was measured; must be one of the garment's sizes. */
  measuredSize: string;
  /** ISO date. */
  measuredOn: string;
  /** Measured after at least one wash (cotton shrinks). */
  afterWash: boolean;
  unit: 'cm' | 'in';
  measurements: SizeMeasurements;
  notes?: string;
}

/** Named points on a top's outline, as seen in a front photo: "Left" is the viewer's left. */
export const TOP_LANDMARKS = [
  'collarLeft',
  'collarRight',
  // Bottom of the front neckline, on the centre line, so the collar lands on the drawn neckline.
  'neckFront',
  'shoulderLeft',
  'shoulderRight',
  'armpitLeft',
  'armpitRight',
  'hemLeft',
  'hemRight',
  // Corners of each short-sleeve opening, so the sleeves get the photo too.
  'sleeveOuterLeft',
  'sleeveInnerLeft',
  'sleeveOuterRight',
  'sleeveInnerRight',
] as const;
export type TopLandmarkName = (typeof TOP_LANDMARKS)[number];

/**
 * A front product photo, and where the garment's landmarks are in it.
 * Used to warp the photo onto the drawn outline of whichever size is worn.
 */
export interface GarmentImage {
  /**
   * Path under app/public, e.g. "garments/ryo-black-henley-front.png". Committed, except
   * cut-outs from photos we don't hold the rights to (listed in app/.gitignore, see
   * app/photo-sources/README.md): those may be missing, and the garment then draws in
   * its flat colour. `npm run data:check` fails on any other missing or narrow image.
   */
  file: string;
  /**
   * The size the photographed garment was, or null when unknown (one photo used
   * for every size). The warp fits the photo to each size's outline either way.
   */
  photographedSize: string | null;
  /** Image pixel coordinates, origin top-left. */
  landmarks: Record<TopLandmarkName, { x: number; y: number }>;
}

export interface GarmentSource {
  /**
   * true = invented numbers for development. Replace before trusting any fit result.
   * Placeholders have no tier: they don't come from any source.
   */
  placeholder: boolean;
  /** Required unless placeholder. */
  tier?: SourceTier;
  url?: string;
  /** ISO date the chart was copied. */
  capturedOn?: string;
  /**
   * A saved copy of the chart, e.g. "chart-snapshots/gildan-5000.pdf" (relative to app/).
   * Kept locally and git-ignored, like product photos — see app/chart-snapshots/README.md.
   */
  snapshot?: string;
  notes?: string;
}

interface GarmentBase {
  id: string;
  brand: string;
  name: string;
  category: GarmentCategory;
  type: GarmentType;
  sizing: GarmentSizing;
  /** A front product photo to texture the garment with. Without one we draw it in `color`. */
  image?: GarmentImage;
  /** Main colour, used to draw the garment on the mannequin. */
  color: string;
  /** Tops only. */
  sleeve?: 'short' | 'long';
  stretch: Stretch;
  fitIntent: FitIntent;
  source: GarmentSource;
  /** Optional hand measurement of one real garment, to check the chart against. */
  audit?: GarmentAudit;
}

/** A garment as written in seed.json. */
export interface SeedGarment extends Omit<GarmentBase, 'stretch'> {
  /** One stretch for the whole garment, or per measurement. */
  stretch: Stretch | StretchByKey;
  chart: {
    unit: 'cm' | 'in';
    /** One method for every girth, or per girth. */
    girth: GirthMethod | GirthByKey;
    /**
     * Tops: required (here or as definitions.length). Bottoms have no top length,
     * so leave it out. The older spelling of definitions.length.
     */
    lengthDefinition?: LengthDefinition;
    /** The older spelling of definitions.sleeve. */
    sleeveDefinition?: SleeveDefinition;
    /** Where measurements are taken. length and sleeve may be given here or as the fields above, not both. */
    definitions?: Definitions;
  };
  sizes: SeedSize[];
}

/** A garment ready for the fit engine: cm, full circumferences. */
export interface Garment extends GarmentBase {
  /**
   * False when the chart didn't say flat vs. full for a girth it lists — those girth
   * zones can't be scored. With a per-girth method, see `girthUnknown` for which.
   */
  girthVerified: boolean;
  /** Set only for a per-girth chart method: the girths whose method is unknown. Read with girthKnown(). */
  girthUnknown?: GirthKey[];
  /** Set only for per-measurement stretch: the overrides on top of `stretch` (the default). Read with stretchOf(). */
  stretchByKey?: Partial<Record<MeasurementKey, Stretch>>;
  lengthDefinition?: LengthDefinition;
  sleeveDefinition?: SleeveDefinition;
  /** Every other definition the chart gives (rise, thigh). Read any definition with definitionOf(). */
  definitions?: Omit<Definitions, 'length' | 'sleeve'>;
  sizes: GarmentSize[];
  grade: ConfidenceGrade;
}
