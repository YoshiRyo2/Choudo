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

/**
 * How a chart reports girths (chest, waist, hips):
 *  - flat: measured laid flat, side to side — double it for the circumference
 *  - circumference: already the full way round
 *  - unknown: the chart doesn't say. We never guess; girth fit comes back "unknown".
 */
export type GirthMethod = 'flat' | 'circumference' | 'unknown';

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

/** How much the fabric gives. Lets a stretchy garment measure under the body without being "tight". */
export type Stretch = 'none' | 'some' | 'high';

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
   * Path under app/public, e.g. "garments/gildan-5000-front.png". Local files only;
   * product photos are not committed (see app/photo-sources/README.md), so the
   * file may be missing and the garment then draws in its flat colour.
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
export interface SeedGarment extends GarmentBase {
  chart: {
    unit: 'cm' | 'in';
    girth: GirthMethod;
    /** Tops: required. Bottoms have no top length, so leave it out. */
    lengthDefinition?: LengthDefinition;
    sleeveDefinition?: SleeveDefinition;
  };
  sizes: SeedSize[];
}

/** A garment ready for the fit engine: cm, full circumferences. */
export interface Garment extends GarmentBase {
  /** False when the chart didn't say flat vs. full — girth zones can't be scored. */
  girthVerified: boolean;
  lengthDefinition?: LengthDefinition;
  sleeveDefinition?: SleeveDefinition;
  sizes: GarmentSize[];
}
