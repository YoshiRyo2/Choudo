/**
 * Uniqlo's public size-chart and product JSON → a seed garment. Pure: the caller
 * fetches (the phone app; the website through a fetch service later) and passes
 * the responses in, parsed or as text.
 *
 * Fetched garments live on the device only. They never go into seed.json.
 */

import { normalizeGarment, validateSeed } from '../garments';
import type { Garment, GarmentSizing, MeasurementKey, SeedGarment, SeedSize } from '../garments';
import type { UniqloLink } from './parse';

const API = 'https://www.uniqlo.com/us/api/commerce/v5/en';

/** The two requests for one product: its size chart (garment measurements) and its name, price and photo. */
export function uniqloUrls(productCode: string): { sizeChart: string; product: string } {
  const code = encodeURIComponent(productCode);
  return {
    sizeChart: `${API}/products/size-charts?productIdsWithColorCode=${code}&includeBodyMeasurements=true&simpleSizeChart=true&httpFailure=true`,
    product: `${API}/products?productIds=${code}&httpFailure=true`,
  };
}

/** Uniqlo's part codes for tees, and the chart key each becomes. Any other code is ignored. */
export const UNIQLO_PART_KEYS: Readonly<Record<string, MeasurementKey>> = {
  'body-width': 'chest',
  'body-length-back': 'length',
  'shoulder-width': 'shoulder',
  'sleeve-length-cb': 'sleeve',
};

/** Drawn colour for fetched garments: the brand photo is a thumbnail only, never on the mannequin. */
export const FETCHED_COLOR = '#a39e96';

export const UNIQLO_NOTES = "Garment measurements from Uniqlo's size chart (laid flat; length and sleeve from centre back).";

/** A fetched garment and what the Check screen shows beside it. */
export interface FetchedProduct {
  garment: SeedGarment;
  /** "$14.90", or null when the product JSON has no price. */
  priceText: string | null;
  /** Shown as it is (a thumbnail), never warped. */
  imageUrl: string | null;
  /** The cleaned product page link ("Open at Uniqlo"). */
  productUrl: string;
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

/** Each response's `result`, or null when it's malformed or its status isn't "ok". */
function results(sizeChartRaw: unknown, productRaw: unknown): { chart: Json | undefined; item: Json | undefined } | null {
  const sizeChart = asResponse(sizeChartRaw);
  const product = asResponse(productRaw);
  if (!sizeChart || !product || sizeChart.status !== 'ok' || product.status !== 'ok') return null;
  if (!Array.isArray(sizeChart.result) || !isObject(product.result) || !Array.isArray(product.result.items)) return null;
  const chart = sizeChart.result[0];
  const item = product.result.items[0];
  if ((chart !== undefined && !isObject(chart)) || (item !== undefined && !isObject(item))) return null;
  return { chart, item };
}

/**
 * True when both responses are well formed with status "ok" but Uniqlo has no such
 * product (no result): the link's product is gone, not a network problem.
 */
export function isMissingProduct(sizeChartRaw: unknown, productRaw: unknown): boolean {
  const r = results(sizeChartRaw, productRaw);
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
const LONG_SLEEVE = /\blong[\s-]*sleeve/i;

function priceText(item: Json): string | null {
  const base = isObject(item.prices) && isObject(item.prices.base) ? item.prices.base : null;
  if (!base || typeof base.value !== 'number' || !(base.value >= 0)) return null;
  const currency = isObject(base.currency) ? base.currency : {};
  const amount = base.value.toFixed(2);
  if (currency.code === 'USD' || (currency.code === undefined && currency.symbol === '$')) return `$${amount}`;
  return typeof currency.code === 'string' ? `${amount} ${currency.code}` : amount;
}

function imageUrl(item: Json, chart: Json, colorCode: string | undefined): string | null {
  const main = isObject(item.images) && isObject(item.images.main) ? item.images.main : {};
  const pick = (v: unknown) => (isObject(v) && typeof v.image === 'string' && /^https:\/\//.test(v.image) ? v.image : null);
  const byColor = colorCode !== undefined ? pick(main[colorCode]) : null;
  const first = Object.values(main).map(pick).find((u) => u !== null) ?? null;
  const fallback = typeof chart.imageUrl === 'string' && /^https:\/\//.test(chart.imageUrl) ? chart.imageUrl : null;
  return byColor ?? first ?? fallback;
}

/**
 * Uniqlo's size chart and product JSON as a seed garment (a top: tee or long-sleeve
 * tee), copied as printed in cm, chest laid flat. Sizes without a chest and a length
 * are left out rather than guessed. `capturedOn` is the ISO date it was fetched.
 */
export function uniqloToSeedGarment(sizeChartRaw: unknown, productRaw: unknown, link: UniqloLink, capturedOn: string): UniqloResult {
  const r = results(sizeChartRaw, productRaw);
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
  const long = LONG_SLEEVE.test(name);
  const garment: SeedGarment = {
    id: `uniqlo-${link.productCode}`,
    brand: 'Uniqlo',
    name,
    category: 'top',
    type: long ? 'long-sleeve-tee' : 'tee',
    sizing: (typeof item.genderCategory === 'string' && SIZING[item.genderCategory]) || 'unisex',
    color: FETCHED_COLOR,
    sleeve: long ? 'long' : 'short',
    stretch: 'none',
    stretchAssumed: true,
    fitIntent: 'regular',
    source: { placeholder: false, tier: 'B', url: link.url, capturedOn, notes: UNIQLO_NOTES },
    chart: { unit: 'cm', girth: 'flat', definitions: { length: 'center_back', sleeve: 'center_back_to_cuff' } },
    sizes: kept,
  };
  return {
    ok: true,
    garment,
    product: { garment, priceText: priceText(item), imageUrl: imageUrl(item, chart, link.colorCode), productUrl: link.url },
  };
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
