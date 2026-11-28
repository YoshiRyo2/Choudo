/**
 * Zara's public search and size-guide JSON → a seed garment, the same shape uniqlo.ts gives.
 * Pure: the caller fetches (the phone directly; the website through the fetch service) and
 * passes the responses in, parsed or as text.
 *
 * Two steps, unlike Uniqlo's two in parallel: the link's number ("04174639") isn't the id
 * the size guide wants, so the search finds the product's colours first (each colour has its
 * own product id), then the guide is asked for the chosen colour's id. Every colour shares
 * one guide. Checked live on 28 Nov 2026 (Zara US, store 11719).
 *
 * Fetched garments live on the device only. Zara's photos are only ever shown as they are:
 * the garment is drawn by Choudo in the colour Zara gives (or colors.ts) and a cut from the
 * name and sleeve numbers.
 */

import type { GarmentSizing, MeasurementKey, Neckline, SeedGarment, SeedSize } from '../garments';
import { colorHex, FETCHED_COLOR } from './colors';
import { cutFromName } from './cut';
import { titleCase } from './names';
import type { ZaraLink } from './parse';
import type { FetchedColor, FetchedProduct, UniqloResult } from './uniqlo';

export { zaraUrls } from './zaraUrls';

/** The same outcome as Uniqlo's converter: a garment and product, or why not. */
export type ZaraResult = UniqloResult;

/** The id a fetched Zara product gets in the catalogue (and the cache key). */
export const zaraGarmentId = (seoId: string): string => `zara-${seoId}`;

export const ZARA_NOTES = "Garment measurements from Zara's product measurements (laid flat; length and sleeve from the shoulder seam).";

/** The guide's measure titles (trimmed, upper case) Choudo reads, and the chart key each becomes. Any other is ignored. */
export const ZARA_MEASURE_KEYS: Readonly<Record<string, MeasurementKey>> = {
  CHEST: 'chest',
  'FRONT LENGTH': 'length',
  'SLEEVE LENGTH': 'sleeve',
  'BACK WIDTH': 'shoulder',
};

/** Families drawn as a tee. Blazers, shirts and knits have a CHEST too, but would be drawn wrong as one. */
const TOP_FAMILY = /T-SHIRT|TOP|BODYSUIT|POLO/i;
/** A chest measured flat: "Measure from side to side at armhole height." */
const FLAT_CHEST = /side to side/i;
/** Sleeves at least this long (shoulder seam to hem, every size) are long; under SHORT_SLEEVE_MAX_CM, short. */
export const LONG_SLEEVE_MIN_CM = 45;
export const SHORT_SLEEVE_MAX_CM = 30;
/** Between the two: drawn short, and named. */
export const MID_SLEEVE_TEXT = 'Mid-length';
/** The photo width asked for in Zara's image address ("…&w={width}"). */
export const ZARA_PHOTO_WIDTH = 750;

const SIZING: Readonly<Record<string, GarmentSizing>> = { WOMAN: 'womens', MAN: 'mens' };

const NECK_WORDS: Readonly<Record<Neckline, string>> = {
  crew: 'Crew neck',
  v: 'V-neck',
  scoop: 'Scoop neck',
  mock: 'High neck',
  henley: 'Henley',
  boat: 'Boat neck',
};

/** One of a Zara product's colours. `code` is Zara's colour id ("401"), `productId` the colour's own product id. */
export interface ZaraColor extends FetchedColor {
  productId: number;
  priceCents: number | null;
  oldPriceCents: number | null;
}

/** What the search says about one product (the results whose seoProductId is the link's number). */
export interface ZaraProduct {
  /** As Zara sends it, upper case: "INTERLOCK LONG-SLEEVE T-SHIRT" (the chosen colour's result). */
  name: string;
  sectionName: string | null;
  familyName: string | null;
  colors: ZaraColor[];
  /** The colour shown: the link's `?v1=` when it's one of them, else the first matching result's. */
  colorProductId: number;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const cents = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
const id = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null);

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

/** The search's results for this product, or null when the search is malformed or not a SUCCESS. */
function matching(searchRaw: unknown, seoId: string): Json[] | null {
  const search = asResponse(searchRaw);
  if (!search || search.status !== 'SUCCESS' || !Array.isArray(search.results)) return null;
  // The search is fuzzy (a made-up number still gets 300 products): only an exact seoProductId counts.
  return search.results
    .map((r) => (isObject(r) && isObject(r.content) ? r.content : null))
    .filter((c): c is Json => c !== null && isObject(c.seo) && c.seo.seoProductId === seoId);
}

/** True when the search is a well-formed SUCCESS with no result for this product: Zara has no such product. */
export function isMissingZara(searchRaw: unknown, seoId: string): boolean {
  const found = matching(searchRaw, seoId);
  return found !== null && found.length === 0;
}

/**
 * True for Zara's answer to a product without a size guide (sent with a 404):
 * `{"message":"Product has not related size and measure guides","content":null}`. Not the
 * fetch service's own 404, which says `"status":"error"`.
 */
export function isMissingZaraGuide(guideRaw: unknown): boolean {
  const guide = asResponse(guideRaw);
  return guide !== null && typeof guide.message === 'string' && !('status' in guide) && !isObject(guide.measureGuideInfo);
}

const discernId = (content: Json): number | null => (isObject(content.seo) ? id(content.seo.discernProductId) : null);
const colorEntries = (content: Json): Json[] =>
  isObject(content.detail) && Array.isArray(content.detail.colors) ? content.detail.colors.filter(isObject) : [];

/** "#365B24" → "#365b24", "#abc" → "#aabbcc"; null for anything else. */
function hexOf(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${[...s.slice(1)].map((c) => c + c).join('')}`;
  return null;
}

/** The first photo of a colour entry, at ZARA_PHOTO_WIDTH; https only. */
function photoOf(entry: Json | undefined): string | null {
  const media = entry && Array.isArray(entry.xmedia) ? entry.xmedia[0] : undefined;
  const url = isObject(media) && typeof media.url === 'string' ? media.url.replace('{width}', String(ZARA_PHOTO_WIDTH)) : '';
  return /^https:\/\/[^\s]+$/.test(url) ? url : null;
}

/**
 * The product from the search: its name, section and family (from the chosen colour's
 * result), and every colour with Zara's hex and that colour's photo. undefined when no result
 * is this product; null when the search is malformed.
 */
export function zaraProduct(searchRaw: unknown, seoId: string, colorProductId?: number): ZaraProduct | undefined | null {
  const found = matching(searchRaw, seoId);
  if (found === null) return null;
  if (found.length === 0) return undefined;

  const hexes = new Map<string, string>();
  for (const content of found) {
    for (const c of Array.isArray(content.availableColors) ? content.availableColors : []) {
      const hex = isObject(c) && typeof c.colorName === 'string' ? hexOf(c.hexColor) : null;
      if (hex && !hexes.has(c.colorName as string)) hexes.set(c.colorName as string, hex);
    }
  }

  // Each result's photos are its own colour's, whichever colour entry they sit in.
  const photoFor = (productId: number): string | null => {
    const own = found.find((c) => discernId(c) === productId);
    if (!own) return null;
    const entries = colorEntries(own);
    return photoOf(entries.find((e) => id(e.productId) === productId) ?? entries[0]);
  };

  const first = found[0]!;
  const ids = new Set(found.flatMap((c) => [discernId(c), ...colorEntries(c).map((e) => id(e.productId))]).filter((n): n is number => n !== null));
  const chosen = colorProductId !== undefined && ids.has(colorProductId) ? colorProductId : (discernId(first) ?? undefined);
  const content = found.find((c) => discernId(c) === chosen) ?? first;
  const name = text(content.name);
  if (name === null || chosen === undefined) return null;

  const seen = new Set<number>();
  const colors: ZaraColor[] = [];
  for (const e of colorEntries(content)) {
    const productId = id(e.productId);
    const colorName = text(e.name);
    const code = text(e.id);
    if (productId === null || colorName === null || code === null || seen.has(productId)) continue;
    seen.add(productId);
    colors.push({
      code,
      productId,
      name: colorName,
      hex: hexes.get(colorName) ?? colorHex(colorName),
      imageUrl: photoFor(productId),
      priceCents: cents(e.price),
      oldPriceCents: cents(e.oldPrice),
    });
  }
  return { name, sectionName: text(content.sectionName), familyName: text(content.familyName), colors, colorProductId: chosen };
}

/** The colour product id to ask the size guide for, or null when the search has no such product. */
export function zaraSizeGuideId(searchRaw: unknown, link: ZaraLink): number | null {
  return zaraProduct(searchRaw, link.seoId, link.colorProductId)?.colorProductId ?? null;
}

/** "43.0" → 43. Only a plain decimal: a range ("43 - 45") or a fraction is no number. */
function cmValue(measure: Json): number | undefined {
  if (!Array.isArray(measure.dimensions)) return undefined;
  const cm = measure.dimensions.find((d) => isObject(d) && d.unitId === 'cm');
  const value = isObject(cm) && typeof cm.value === 'string' ? cm.value.trim() : '';
  if (!/^\d+(\.\d+)?$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 ? n : undefined;
}

const titleOf = (measure: Json): string => (typeof measure.tableTitle === 'string' ? measure.tableTitle.trim().toUpperCase() : '');

function sizeOf(entry: unknown): SeedSize | null {
  if (!isObject(entry) || text(entry.name) === null || !Array.isArray(entry.measures)) return null;
  const measurements: SeedSize['measurements'] = {};
  for (const m of entry.measures) {
    if (!isObject(m)) continue;
    const key = ZARA_MEASURE_KEYS[titleOf(m)];
    const value = cmValue(m);
    if (key !== undefined && value !== undefined) measurements[key] = value;
  }
  return { label: text(entry.name)!, measurements };
}

/** Every CHEST in the guide says it's measured side to side (laid flat). */
function chestIsFlat(sizes: unknown[]): boolean {
  return sizes.every(
    (s) =>
      !isObject(s) ||
      !Array.isArray(s.measures) ||
      s.measures.every((m) => !isObject(m) || titleOf(m) !== 'CHEST' || (typeof m.description === 'string' && FLAT_CHEST.test(m.description))),
  );
}

/** Short or long from the name, else from every size's sleeve; in between is drawn short and named. */
function sleeveOf(name: string, sizes: SeedSize[]): { sleeve: 'short' | 'long'; otherSleeve?: string } {
  const named = cutFromName(name).sleeve;
  if (named) return { sleeve: named };
  // Plain numbers: sizeOf copies only the guide's printed cm.
  const sleeves = sizes.map((s) => s.measurements.sleeve).map((v) => (typeof v === 'number' ? v : undefined));
  if (sleeves.length === 0 || sleeves.some((v) => v === undefined)) return { sleeve: 'short' };
  if (sleeves.every((v) => v! >= LONG_SLEEVE_MIN_CM)) return { sleeve: 'long' };
  if (sleeves.every((v) => v! < SHORT_SLEEVE_MAX_CM)) return { sleeve: 'short' };
  return { sleeve: 'short', otherSleeve: MID_SLEEVE_TEXT };
}

const dollars = (c: number | null): string | null => (c === null ? null : `$${(c / 100).toFixed(2)}`);

/**
 * Zara's search and size guide as a seed garment (a top: tee or long-sleeve tee), copied as
 * printed in cm, chest laid flat, length and sleeve from the shoulder seam, drawn in the
 * link's colour. Sizes without a chest and a length are left out rather than guessed; a chest
 * the guide doesn't say is flat isn't guessed either. `capturedOn` is the ISO date it was fetched.
 */
export function zaraToSeedGarment(searchRaw: unknown, guideRaw: unknown, link: ZaraLink, capturedOn: string): ZaraResult {
  const product = zaraProduct(searchRaw, link.seoId, link.colorProductId);
  if (!product) return { ok: false, reason: 'bad-response' };
  const guide = asResponse(guideRaw);
  if (!guide) return { ok: false, reason: 'bad-response' };
  const info = guide.measureGuideInfo;
  if (!isObject(info) || !Array.isArray(info.sizes) || info.sizes.length === 0) return { ok: false, reason: 'no-sizes' };
  // Tops only for now, and only ones drawn right as a tee.
  if (product.familyName === null || !TOP_FAMILY.test(product.familyName)) return { ok: false, reason: 'unsupported-parts' };
  if (!chestIsFlat(info.sizes)) return { ok: false, reason: 'unsupported-parts' };

  const seen = new Set<string>();
  const kept = info.sizes
    .map(sizeOf)
    .filter((s): s is SeedSize => s !== null)
    .filter((s) => {
      if (s.measurements.chest === undefined || s.measurements.length === undefined || seen.has(s.label)) return false;
      seen.add(s.label);
      return true;
    });
  if (kept.length === 0) return { ok: false, reason: 'unsupported-parts' };

  const name = titleCase(product.name);
  const color = product.colors.find((c) => c.productId === product.colorProductId) ?? product.colors[0];
  const { neckline } = cutFromName(name);
  const { sleeve, otherSleeve } = sleeveOf(name, kept);
  const garment: SeedGarment = {
    id: zaraGarmentId(link.seoId),
    brand: 'Zara',
    name,
    category: 'top',
    type: sleeve === 'long' ? 'long-sleeve-tee' : 'tee',
    sizing: (product.sectionName !== null && SIZING[product.sectionName]) || 'unisex',
    color: color?.hex ?? FETCHED_COLOR,
    sleeve,
    ...(neckline ? { neckline } : {}),
    stretch: 'none',
    stretchAssumed: true,
    // As Uniqlo's: link garments stay "regular" (see UniqloCut.fit).
    fitIntent: 'regular',
    source: { placeholder: false, tier: 'B', url: link.url, capturedOn, notes: ZARA_NOTES },
    chart: { unit: 'cm', girth: 'flat', definitions: { length: 'hps', sleeve: 'shoulder_to_cuff' } },
    sizes: kept,
  };
  const words = [neckline ? NECK_WORDS[neckline] : null, `${otherSleeve ?? (sleeve === 'long' ? 'Long' : 'Short')} sleeve`];
  const out: FetchedProduct = {
    garment,
    priceText: dollars(color?.priceCents ?? null),
    imageUrl: color?.imageUrl ?? null,
    productUrl: link.url,
    cutText: words.filter((w): w is string => w !== null).join(' · '),
  };
  if (color) {
    out.colorCode = color.code;
    out.colorName = color.name;
  }
  // Stored as FetchedColor: the colour's product id and price aren't needed once the guide is in.
  if (product.colors.length > 0) out.colors = product.colors.map(({ code, name: n, hex, imageUrl }) => ({ code, name: n, hex, imageUrl }));
  if (otherSleeve) out.otherSleeve = otherSleeve;
  return { ok: true, garment, product: out };
}
