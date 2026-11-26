export { parseProductLink } from './parse';
export type { ProductLink, UniqloLink, UnknownLink } from './parse';
export {
  FETCHED_COLOR,
  isMissingProduct,
  readyFetchedGarment,
  UNIQLO_NOTES,
  UNIQLO_PART_KEYS,
  uniqloToSeedGarment,
  uniqloUrls,
} from './uniqlo';
export type { FetchedProduct, UniqloFailure, UniqloResult } from './uniqlo';
