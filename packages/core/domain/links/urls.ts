/**
 * Uniqlo US's two public JSON addresses for one product. Imports nothing, so the fetch
 * service (worker/) bundles this file alone: it calls only these two addresses.
 */

const API = 'https://www.uniqlo.com/us/api/commerce/v5/en';

/** A Uniqlo product code: letter + 6 digits + "-" + 3 digits ("E424873-000"), any case. */
export const UNIQLO_PRODUCT_CODE = /^[a-z]\d{6}-\d{3}$/i;

/**
 * The two requests for one product: its size chart (garment measurements) and its
 * details (name, price, colours with a photo each, and the fit / sleeve / neck tags).
 */
export function uniqloUrls(productCode: string): { sizeChart: string; details: string } {
  const code = encodeURIComponent(productCode);
  return {
    sizeChart: `${API}/products/size-charts?productIdsWithColorCode=${code}&includeBodyMeasurements=true&simpleSizeChart=true&httpFailure=true`,
    details: `${API}/products/${code}/price-groups/00/details?includeModelSize=false&httpFailure=true`,
  };
}
