/**
 * Zara US's two public JSON addresses for one product. Imports nothing, so the fetch
 * service (worker/) bundles this file alone, as urls.ts: it calls only these addresses.
 */

const API = 'https://www.zara.com/itxrest';
/** Zara's US store. */
const STORE = 11719;

/** The 8-digit number in a Zara product link ("…-p04174639.html" → "04174639"). */
export const ZARA_SEO_ID = /^\d{8}$/;
/** A colour's product id, which the size guide is asked for ("616513993"). */
export const ZARA_PRODUCT_ID = /^\d{6,12}$/;

/**
 * The two requests for one product: the search that finds its colours (by the link's
 * number) and the size guide (garment measurements) for one colour's product id.
 */
export const zaraUrls = {
  search: (seoId: string): string => `${API}/1/search/store/${STORE}/query?query=${encodeURIComponent(seoId)}&locale=en_US`,
  sizeGuide: (colorProductId: string | number): string =>
    `${API}/5/catalog/store/${STORE}/product/${encodeURIComponent(String(colorProductId))}/size-measure-guide?locale=en_US`,
};
