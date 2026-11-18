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

export interface GarmentSize {
  /** As printed on the tag, e.g. "M" or "32x30". */
  label: string;
  measurements: SizeMeasurements;
}

/** Named points on a top's outline, as seen in a front photo: "Left" is the viewer's left. */
export const TOP_LANDMARKS = [
  'collarLeft',
  'collarRight',
  'shoulderLeft',
  'shoulderRight',
  'armpitLeft',
  'armpitRight',
  'hemLeft',
  'hemRight',
] as const;
export type TopLandmarkName = (typeof TOP_LANDMARKS)[number];

/**
 * A front product photo, and where the garment's landmarks are in it.
 * Used to warp the photo onto the drawn outline of whichever size is worn.
 */
export interface GarmentImage {
  /** Path under app/public, e.g. "garments/gildan-5000-front.png". Local files only. */
  file: string;
  /** The size the photographed garment was. */
  photographedSize: string;
  /** Image pixel coordinates, origin top-left. */
  landmarks: Record<TopLandmarkName, { x: number; y: number }>;
}

export interface GarmentSource {
  /** true = invented numbers for development. Replace before trusting any fit result. */
  placeholder: boolean;
  url?: string;
  /** ISO date the chart was copied. */
  capturedOn?: string;
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
  source: GarmentSource;
  sizes: GarmentSize[];
}

/** A garment as written in seed.json. */
export interface SeedGarment extends GarmentBase {
  chart: {
    unit: 'cm' | 'in';
    girth: GirthMethod;
    sleeveDefinition?: SleeveDefinition;
  };
}

/** A garment ready for the fit engine: cm, full circumferences. */
export interface Garment extends GarmentBase {
  /** False when the chart didn't say flat vs. full — girth zones can't be scored. */
  girthVerified: boolean;
  sleeveDefinition?: SleeveDefinition;
}
