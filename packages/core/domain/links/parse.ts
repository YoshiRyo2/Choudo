/**
 * Reading a pasted product link: which brand, which product. Pure: no fetch, no URL
 * global (core has no DOM lib), so the link is split with plain string rules.
 */

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

/**
 * Any other link. `uniqlo` says why a uniqlo.com link isn't one we read:
 * another region's shop, or not a product page.
 */
export interface UnknownLink {
  brand: 'unknown';
  /** Lower case, no port. */
  host: string;
  uniqlo?: 'other-region' | 'not-a-product';
}

export type ProductLink = UniqloLink | UnknownLink;

/** The first http(s)://, www. or bare uniqlo.com/ address in the text. */
const URL_IN_TEXT = /(?:https?:\/\/|www\.|\b(?:m\.)?uniqlo\.com\/)[^\s<>"'`]*/i;
/** Punctuation a sentence puts after a link, not part of it. */
const TRAILING = /[).,;:!?\]}»”’]+$/;
/** scheme? host port? path query? fragment? */
const URL_PARTS = /^(?:https?:\/\/)?([^/?#:@\s]+)(?::\d+)?([^?#]*)(\?[^#]*)?(#.*)?$/i;

const UNIQLO_HOST = /^(?:(?:www|m)\.)?uniqlo\.com$/;
const PRODUCT_CODE = /^[a-z]\d{6}-\d{3}$/i;
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
  if (!UNIQLO_HOST.test(host)) return { brand: 'unknown', host };

  const path = (parts[2] ?? '').split('/').filter((p) => p !== '');
  const [region, lang, products, code, color] = path;
  const isProduct =
    path.length <= 5 &&
    lang !== undefined &&
    LANG.test(lang) &&
    products === 'products' &&
    code !== undefined &&
    PRODUCT_CODE.test(code) &&
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
