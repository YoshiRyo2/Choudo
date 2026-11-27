/**
 * Uniqlo's public size-chart and product-details JSON → a seed garment. Pure: the
 * caller fetches (the phone app; the website through a fetch service later) and passes
 * the responses in, parsed or as text.
 *
 * Fetched garments live on the device only. They never go into seed.json. Uniqlo's
 * photos are only ever shown as they are: the garment is drawn by Choudo in the
 * product's colour (colors.ts) and cut (cut.ts).
 */

import { normalizeGarment, validateSeed } from '../garments';
import type { Garment, GarmentSizing, MeasurementKey, SeedGarment, SeedSize } from '../garments';
import { colorHex, FETCHED_COLOR } from './colors';
import { uniqloCut } from './cut';
import type { UniqloLink } from './parse';

export { FETCHED_COLOR } from './colors';

export { uniqloUrls } from './urls';

/** The id a fetched Uniqlo product gets in the catalogue (and the cache key). */
export const uniqloGarmentId = (productCode: string): string => `uniqlo-${productCode}`;

/** Uniqlo's part codes for tees, and the chart key each becomes. Any other code is ignored. */
export const UNIQLO_PART_KEYS: Readonly<Record<string, MeasurementKey>> = {
  'body-width': 'chest',
  'body-length-back': 'length',
  'shoulder-width': 'shoulder',
  'sleeve-length-cb': 'sleeve',
};

export const UNIQLO_NOTES = "Garment measurements from Uniqlo's size chart (laid flat; length and sleeve from centre back).";

/** One of a product's colours: Uniqlo's display code and name, our drawing hex, and its photo. */
export interface FetchedColor {
  /** The link's last path part, e.g. "09". */
  code: string;
  /** As Uniqlo names it, e.g. "BLACK". */
  name: string;
  /** colorHex(name): what the mannequin is drawn in. */
  hex: string;
  /** The product photo in this colour, shown as it is; null when there's none. */
  imageUrl: string | null;
}

/**
 * A fetched garment and what the Check screen shows beside it. The fields after
 * productUrl came with the details endpoint: entries stored before it lack them.
 */
export interface FetchedProduct {
  garment: SeedGarment;
  /** "$14.90", or null when the product JSON has no price. */
  priceText: string | null;
  /** The photo for the chosen colour, shown as it is (never cropped, recoloured or warped). */
  imageUrl: string | null;
  /** The cleaned product page link ("Open at Uniqlo"). */
  productUrl: string;
  /** The chosen colour's code and name; `garment.color` is its hex. */
  colorCode?: string;
  colorName?: string;
  /** Every colour the product comes in, as the details list them. */
  colors?: FetchedColor[];
  /** The tags in words: "Crew Neck · Short sleeve · Regular fit". */
  cutText?: string;
  /** A sleeve Choudo draws as short for now ("Sleeveless", "Half", "8/10"). */
  otherSleeve?: string;
}

export type UniqloFailure = 'no-sizes' | 'unsupported-parts' | 'bad-response';
export type UniqloResult = { ok: true; garment: SeedGarment; product: FetchedProduct } | { ok: false; reason: UniqloFailure };

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A response as an object: parsed text, or the object itself; null for anything else. */
function asResponse(raw: unknown): Json | null {
  if (typeof raw === 'string') {
    try {
      return asResponse(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return isObject(raw) ? raw : null;
}

/**
 * The product from a details response (`result` is the product), or from the older
 * products?productIds= shape (`result.items[0]`), which is what entries fetched before
 * the details endpoint came from. undefined = no product; null = malformed.
 */
function productOf(result: unknown): Json | undefined | null {
  if (!isObject(result)) return null;
  if (Array.isArray(result.items)) {
    const item = result.items[0];
    return item === undefined ? undefined : isObject(item) ? item : null;
  }
  return Object.keys(result).length === 0 ? undefined : result;
}

/** Each response's `result`, or null when it's malformed or its status isn't "ok". */
function results(sizeChartRaw: unknown, detailsRaw: unknown): { chart: Json | undefined; item: Json | undefined } | null {
  const sizeChart = asResponse(sizeChartRaw);
  const details = asResponse(detailsRaw);
  if (!sizeChart || !details || sizeChart.status !== 'ok' || details.status !== 'ok') return null;
  if (!Array.isArray(sizeChart.result)) return null;
  const chart = sizeChart.result[0];
  const item = productOf(details.result);
  if ((chart !== undefined && !isObject(chart)) || item === null) return null;
  return { chart, item };
}

/** Uniqlo's catalogue error for a product it doesn't have (sent with a 404). */
const NO_SUCH_PRODUCT = 25;

/**
 * True when Uniqlo has no such product: a well-formed "ok" with no result, or the
 * details' "nok" with the catalogue's no-such-product code. Gone, not a network problem.
 */
export function isMissingProduct(sizeChartRaw: unknown, detailsRaw: unknown): boolean {
  const details = asResponse(detailsRaw);
  if (details?.status === 'nok' && isObject(details.error) && details.error.code === NO_SUCH_PRODUCT) return true;
  const r = results(sizeChartRaw, detailsRaw);
  return r !== null && (r.chart === undefined || r.item === undefined);
}

/** "61.5" → 61.5. Only a plain decimal: a range ("83 - 89") or a fraction is no number. */
function cmValue(part: Json): number | undefined {
  if (!Array.isArray(part.measurements)) return undefined;
  const cm = part.measurements.find((m) => isObject(m) && m.unit === 'cm');
  const text = isObject(cm) && typeof cm.value === 'string' ? cm.value.trim() : '';
  if (!/^\d+(\.\d+)?$/.test(text)) return undefined;
  const n = Number(text);
  return n > 0 ? n : undefined;
}

function sizeOf(entry: unknown): SeedSize | null {
  if (!isObject(entry) || typeof entry.name !== 'string' || entry.name.trim() === '' || !Array.isArray(entry.sizeParts)) return null;
  const measurements: SeedSize['measurements'] = {};
  for (const part of entry.sizeParts) {
    if (!isObject(part) || typeof part.code !== 'string') continue;
    const key = UNIQLO_PART_KEYS[part.code];
    const value = cmValue(part);
    if (key !== undefined && value !== undefined) measurements[key] = value;
  }
  return { label: entry.name.trim(), measurements };
}

const SIZING: Readonly<Record<string, GarmentSizing>> = { WOMEN: 'womens', MEN: 'mens' };

function priceText(item: Json): string | null {
  const base = isObject(item.prices) && isObject(item.prices.base) ? item.prices.base : null;
  if (!base || typeof base.value !== 'number' || !(base.value >= 0)) return null;
  const currency = isObject(base.currency) ? base.currency : {};
  const amount = base.value.toFixed(2);
  if (currency.code === 'USD' || (currency.code === undefined && currency.symbol === '$')) return `$${amount}`;
  return typeof currency.code === 'string' ? `${amount} ${currency.code}` : amount;
}

const mainImages = (item: Json): Json => (isObject(item.images) && isObject(item.images.main) ? item.images.main : {});
const photo = (v: unknown) => (isObject(v) && typeof v.image === 'string' && /^https:\/\//.test(v.image) ? v.image : null);

function imageUrl(item: Json, chart: Json, colorCode: string | undefined): string | null {
  const main = mainImages(item);
  const byColor = colorCode !== undefined ? photo(main[colorCode]) : null;
  const first = Object.values(main).map(photo).find((u) => u !== null) ?? null;
  const fallback = typeof chart.imageUrl === 'string' && /^https:\/\//.test(chart.imageUrl) ? chart.imageUrl : null;
  return byColor ?? first ?? fallback;
}

/** The product's colours (details `colors[]`), each with its drawing hex and photo. */
function colorsOf(item: Json): FetchedColor[] {
  if (!Array.isArray(item.colors)) return [];
  const main = mainImages(item);
  const seen = new Set<string>();
  const out: FetchedColor[] = [];
  for (const c of item.colors) {
    if (!isObject(c) || typeof c.displayCode !== 'string' || typeof c.name !== 'string' || seen.has(c.displayCode)) continue;
    seen.add(c.displayCode);
    out.push({ code: c.displayCode, name: c.name, hex: colorHex(c.name), imageUrl: photo(main[c.displayCode]) });
  }
  return out;
}

/**
 * The colour to draw for a link: the details colour whose display code matches the
 * link's last path part, else the first colour; null when the details list none.
 */
export function uniqloColor(detailsRaw: unknown, colorCode: string | undefined): FetchedColor | null {
  const details = asResponse(detailsRaw);
  const item = details ? productOf(details.result) : null;
  if (!item) return null;
  const colors = colorsOf(item);
  return colors.find((c) => c.code === colorCode) ?? colors[0] ?? null;
}

/**
 * Uniqlo's size chart and product details as a seed garment (a top: tee or long-sleeve
 * tee), copied as printed in cm, chest laid flat, drawn in the link's colour with the
 * tags' sleeve and neckline (the fit tag is only shown, in cutText). Sizes without a chest and a length are left out
 * rather than guessed. The older products?productIds= JSON still reads (no colours or
 * tags: neutral colour, cut from the name). `capturedOn` is the ISO date it was fetched.
 */
export function uniqloToSeedGarment(sizeChartRaw: unknown, detailsRaw: unknown, link: UniqloLink, capturedOn: string): UniqloResult {
  const r = results(sizeChartRaw, detailsRaw);
  if (r === null || r.item === undefined || r.chart === undefined) return { ok: false, reason: 'bad-response' };
  const { chart, item } = r;
  if (typeof item.name !== 'string' || item.name.trim() === '') return { ok: false, reason: 'bad-response' };
  if (!Array.isArray(chart.sizeChart) || chart.sizeChart.length === 0) return { ok: false, reason: 'no-sizes' };

  const sizes = chart.sizeChart.map(sizeOf).filter((s): s is SeedSize => s !== null);
  // Tops only for now: a chart with no chest anywhere is something else (pants, a bag).
  if (!sizes.some((s) => s.measurements.chest !== undefined)) return { ok: false, reason: 'unsupported-parts' };
  const seen = new Set<string>();
  const kept = sizes.filter((s) => {
    if (s.measurements.chest === undefined || s.measurements.length === undefined || seen.has(s.label)) return false;
    seen.add(s.label);
    return true;
  });
  if (kept.length === 0) return { ok: false, reason: 'unsupported-parts' };

  const name = item.name.trim();
  const cut = uniqloCut(item.tags, name);
  const colors = colorsOf(item);
  const color = colors.find((c) => c.code === link.colorCode) ?? colors[0];
  const garment: SeedGarment = {
    id: uniqloGarmentId(link.productCode),
    brand: 'Uniqlo',
    name,
    category: 'top',
    type: cut.sleeve === 'long' ? 'long-sleeve-tee' : 'tee',
    sizing: (typeof item.genderCategory === 'string' && SIZING[item.genderCategory]) || 'unisex',
    color: color?.hex ?? FETCHED_COLOR,
    sleeve: cut.sleeve,
    ...(cut.neckline ? { neckline: cut.neckline } : {}),
    stretch: 'none',
    stretchAssumed: true,
    // Not cut.fit: the fit tag is shown (cutText) but doesn't size yet. See UniqloCut.fit.
    fitIntent: 'regular',
    source: { placeholder: false, tier: 'B', url: link.url, capturedOn, notes: UNIQLO_NOTES },
    chart: { unit: 'cm', girth: 'flat', definitions: { length: 'center_back', sleeve: 'center_back_to_cuff' } },
    sizes: kept,
  };
  const product: FetchedProduct = {
    garment,
    priceText: priceText(item),
    imageUrl: color?.imageUrl ?? imageUrl(item, chart, link.colorCode),
    productUrl: link.url,
  };
  if (color) {
    product.colorCode = color.code;
    product.colorName = color.name;
  }
  if (colors.length > 0) product.colors = colors;
  if (cut.text) product.cutText = cut.text;
  if (cut.otherSleeve) product.otherSleeve = cut.otherSleeve;
  return { ok: true, garment, product };
}

/**
 * A fetched (or stored) seed garment, checked and ready for the fit engine like
 * any seed row; null when it fails the seed checks, so it's dropped.
 */
export function readyFetchedGarment(garment: SeedGarment): Garment | null {
  try {
    return validateSeed([garment]).length === 0 ? normalizeGarment(garment) : null;
  } catch {
    // A stored row from an older or damaged shape: drop it rather than crash the catalogue.
    return null;
  }
}
