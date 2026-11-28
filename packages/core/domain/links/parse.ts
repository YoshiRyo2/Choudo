/**
 * Reading a pasted product link: which brand, which product. Pure: no fetch, no URL
 * global (core has no DOM lib), so the link is split with plain string rules.
 */

import { UNIQLO_PRODUCT_CODE } from './urls';
import { ZARA_PRODUCT_ID } from './zaraUrls';

/** A Uniqlo US product page: www.uniqlo.com/us/<lang>/products/<code>[/<colour>]. */
export interface UniqloLink {
  brand: 'uniqlo';
  region: 'us';
  /** Letter + 6 digits + "-" + 3 digits, upper case: "E424873-000". */
  productCode: string;
  /** The colour part after the code ("00"), when the link has one. */
  colorCode?: string;
  /** The link as Choudo keeps it: https, www host, no query or fragment. */
  url: string;
}

/** A Zara US product page: www.zara.com/us/<lang>/<slug>-p<8 digits>.html[?v1=<colour product id>]. */
export interface ZaraLink {
  brand: 'zara';
  region: 'us';
  /** The 8 digits after "-p": "04174639". Zara's search finds the product by it. */
  seoId: string;
  /** The colour's product id from `?v1=`, when the link has one (shared links often do). */
  colorProductId?: number;
  /** The link as Choudo keeps it: https, www host, /us/en/, `?v1=` only when it was there. */
  url: string;
}

/** Why a brand's own link isn't one we read: another region's shop, or not a product page. */
export type BrandLinkReason = 'other-region' | 'not-a-product';

/** Any other link. `uniqlo` / `zara` say why that brand's link isn't one we read. */
export interface UnknownLink {
  brand: 'unknown';
  /** Lower case, no port. */
  host: string;
  uniqlo?: BrandLinkReason;
  zara?: BrandLinkReason;
}

export type ProductLink = UniqloLink | ZaraLink | UnknownLink;

/** The brands Choudo reads a product link from. */
export type LinkBrand = 'uniqlo' | 'zara';

/** The brand a link is from (also a brand link Choudo can't read yet), or undefined. */
export function linkBrand(link: ProductLink | null): LinkBrand | undefined {
  if (link === null) return undefined;
  if (link.brand !== 'unknown') return link.brand;
  if (link.uniqlo) return 'uniqlo';
  if (link.zara) return 'zara';
  return undefined;
}

/** The first http(s)://, www. or bare uniqlo.com/ or zara.com/ address in the text. */
const URL_IN_TEXT = /(?:https?:\/\/|www\.|\b(?:m\.)?(?:uniqlo|zara)\.com\/)[^\s<>"'`]*/i;
/** Punctuation a sentence puts after a link, not part of it. */
const TRAILING = /[).,;:!?\]}»”’]+$/;
/** scheme? host port? path query? fragment? */
const URL_PARTS = /^(?:https?:\/\/)?([^/?#:@\s]+)(?::\d+)?([^?#]*)(\?[^#]*)?(#.*)?$/i;

const UNIQLO_HOST = /^(?:(?:www|m)\.)?uniqlo\.com$/;
const ZARA_HOST = /^(?:(?:www|m)\.)?zara\.com$/;
/** A Zara product page's last path part: "<slug>-p<8 digits>.html", the slug possibly empty. */
const ZARA_PAGE = /^(.*)-p(\d{8})\.html$/i;
const REGION = /^[a-z]{2}$/i;
const COLOR_CODE = /^\d{2,3}$/;
const LANG = /^[a-z]{2}$/i;

/**
 * What a pasted link points at, or null when the text has no link. Words around
 * the link are fine ("Look at this https://… !"); only the first link counts.
 */
export function parseProductLink(text: string): ProductLink | null {
  const found = URL_IN_TEXT.exec(text)?.[0].replace(TRAILING, '');
  if (!found) return null;
  const parts = URL_PARTS.exec(found);
  if (!parts) return null;
  const host = parts[1]!.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.')) return null;
  if (ZARA_HOST.test(host)) return zaraLink(host, parts[2] ?? '', parts[3]);
  if (!UNIQLO_HOST.test(host)) return { brand: 'unknown', host };

  const path = (parts[2] ?? '').split('/').filter((p) => p !== '');
  const [region, lang, products, code, color] = path;
  const isProduct =
    path.length <= 5 &&
    lang !== undefined &&
    LANG.test(lang) &&
    products === 'products' &&
    code !== undefined &&
    UNIQLO_PRODUCT_CODE.test(code) &&
    (color === undefined || COLOR_CODE.test(color));
  if (!isProduct) return { brand: 'unknown', host, uniqlo: 'not-a-product' };
  if (region!.toLowerCase() !== 'us') return { brand: 'unknown', host, uniqlo: 'other-region' };

  const productCode = code!.toUpperCase();
  const link: UniqloLink = {
    brand: 'uniqlo',
    region: 'us',
    productCode,
    url: `https://www.uniqlo.com/us/${lang!.toLowerCase()}/products/${productCode}${color !== undefined ? `/${color}` : ''}`,
  };
  if (color !== undefined) link.colorCode = color;
  return link;
}

/** The `v1` value of a query string ("?v1=616513993&utm_source=x"), or undefined. */
function v1Of(query: string | undefined): string | undefined {
  if (!query) return undefined;
  for (const pair of query.slice(1).split('&')) {
    const [key, value] = pair.split('=');
    if (key === 'v1') return value;
  }
  return undefined;
}

/** A zara.com link: a US product page, or why not. Only `?v1=` is read from the query. */
function zaraLink(host: string, pathname: string, query: string | undefined): ZaraLink | UnknownLink {
  const path = pathname.split('/').filter((p) => p !== '');
  const [region, lang, page] = path;
  const m = page !== undefined ? ZARA_PAGE.exec(page) : null;
  const isProduct = path.length === 3 && REGION.test(region!) && lang !== undefined && LANG.test(lang) && m !== null;
  if (!isProduct) return { brand: 'unknown', host, zara: 'not-a-product' };
  if (region!.toLowerCase() !== 'us') return { brand: 'unknown', host, zara: 'other-region' };

  const seoId = m[2]!;
  const v1 = v1Of(query);
  const color = v1 !== undefined && ZARA_PRODUCT_ID.test(v1) ? v1 : undefined;
  const link: ZaraLink = {
    brand: 'zara',
    region: 'us',
    seoId,
    url: `https://www.zara.com/us/en/${m[1]!}-p${seoId}.html${color !== undefined ? `?v1=${color}` : ''}`,
  };
  if (color !== undefined) link.colorProductId = Number(color);
  return link;
}
