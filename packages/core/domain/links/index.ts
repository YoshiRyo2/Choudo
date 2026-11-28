export { COLOR_BASES, colorHex, DARK_MIX, LIGHT_MIX } from './colors';
export { cutFromName, uniqloCut } from './cut';
export type { NameCut, UniqloCut } from './cut';
export { titleCase } from './names';
export { linkBrand, parseProductLink } from './parse';
export type { BrandLinkReason, LinkBrand, ProductLink, UniqloLink, UnknownLink, ZaraLink } from './parse';
export {
  FETCHED_COLOR,
  isMissingProduct,
  readyFetchedGarment,
  UNIQLO_NOTES,
  UNIQLO_PART_KEYS,
  uniqloGarmentId,
  uniqloColor,
  uniqloToSeedGarment,
} from './uniqlo';
export { UNIQLO_PRODUCT_CODE, uniqloUrls } from './urls';
export type { FetchedColor, FetchedProduct, UniqloFailure, UniqloResult } from './uniqlo';
export {
  isMissingZara,
  isMissingZaraGuide,
  ZARA_MEASURE_KEYS,
  ZARA_NOTES,
  zaraGarmentId,
  zaraProduct,
  zaraSizeGuideId,
  zaraToSeedGarment,
} from './zara';
export type { ZaraColor, ZaraProduct, ZaraResult } from './zara';
export { ZARA_PRODUCT_ID, ZARA_SEO_ID, zaraUrls } from './zaraUrls';
