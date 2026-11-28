/**
 * The Check tab's wording ("What size should I buy?"): paste a product link, get a size.
 * Errors say what happened and the next step, never whose fault it was.
 */

import { titleCase, type LinkBrand, type ProductLink } from '../domain/links';

export type { LinkBrand } from '../domain/links';

export const CHECK_TEXT = {
  title: 'What size should I buy?',
  field: 'Paste a Uniqlo or Zara link',
  paste: 'Paste',
  submit: 'Check size',
  scope: 'Works with Uniqlo US and Zara US tops for now.',
  retry: 'Retry',
  tryOn: 'Try it on',
  recent: 'Recent checks',
  fromLink: 'From your link',
  unsupportedHosts: 'Unsupported hosts',
  /** Over the mannequin preview drawn by Choudo. */
  onYou: 'On you',
  colour: 'Colour',
  /** Under the result when the product's sleeve is neither short nor long (drawn short). */
  otherSleeve: 'Choudo draws short and long sleeves only for now.',
} as const;

/** "OFF WHITE" → "Off White": a colour name as the brand gives it, for reading. */
export const colourLabel = (name: string): string => titleCase(name);

const BRAND_NAME: Record<LinkBrand, string> = { uniqlo: 'Uniqlo', zara: 'Zara' };
const BRAND_SITE: Record<LinkBrand, string> = { uniqlo: 'uniqlo.com', zara: 'zara.com' };

/** The lines that name the brand being checked: "Reading Zara’s size chart…", "Open at Zara", "Photo: Zara". */
export function brandText(brand: LinkBrand): { loading: string; openAt: string; photoCredit: string } {
  const name = BRAND_NAME[brand];
  return {
    loading: `Reading ${name}’s size chart…`,
    openAt: `Open at ${name}`,
    /** Under the brand's photo, which is shown as it is. */
    photoCredit: `Photo: ${name}`,
  };
}

/** The brand a checked product came from (its garment's `brand`, "Uniqlo" or "Zara"). */
export const productBrand = (garment: { brand: string }): LinkBrand => (garment.brand === BRAND_NAME.zara ? 'zara' : 'uniqlo');

/** Why a check didn't give a size. */
export type CheckError =
  | 'no-link'
  | 'unknown-brand'
  | 'other-region'
  | 'network'
  | 'not-found'
  | 'unsupported-parts'
  | 'no-sizes'
  | 'unreadable-chart'
  | 'bad-response';

const errorText = (brand: LinkBrand): Record<CheckError, string> => {
  const name = BRAND_NAME[brand];
  return {
    'no-link': `Paste a product link from ${BRAND_SITE[brand]}.`,
    'unknown-brand': 'Choudo can read Uniqlo and Zara links for now. More brands soon.',
    'other-region': `Only ${name} US links for now.`,
    network: `Couldn’t reach ${name}. Check your connection and try again.`,
    'not-found': `${name} has no product at this link. Paste another product link.`,
    'unsupported-parts': `Choudo can only check tops from ${name} for now.`,
    'no-sizes': `${name} doesn’t list garment measurements for this product. Try another one.`,
    'unreadable-chart': 'Choudo can’t read this product’s size chart yet. Try another product.',
    'bad-response': `Couldn’t read ${name}’s size chart. Try again in a moment.`,
  };
};

const ERROR_TEXT: Record<LinkBrand, Record<CheckError, string>> = { uniqlo: errorText('uniqlo'), zara: errorText('zara') };

/** Pasted text with no link in it: either brand's site. */
const NO_LINK_ANY = 'Paste a product link from uniqlo.com or zara.com.';

/**
 * An error in words, naming the brand of the link it's about. Without a brand (no link at
 * all), "no-link" names both sites and the rest read as Uniqlo's.
 */
export const checkErrorText = (error: CheckError, brand?: LinkBrand): string =>
  brand === undefined && error === 'no-link' ? NO_LINK_ANY : ERROR_TEXT[brand ?? 'uniqlo'][error];

/** Errors a second try might fix: they get a Retry button. */
export const canRetry = (error: CheckError): boolean => error === 'network' || error === 'bad-response';

/**
 * Why a pasted text isn't a link Choudo can read, or null when it is one (a Uniqlo US or
 * Zara US product page). A brand's page that isn't a product gets the "paste a product link" line.
 */
export function linkError(link: ProductLink | null): CheckError | null {
  if (link === null) return 'no-link';
  if (link.brand === 'uniqlo' || link.brand === 'zara') return null;
  const reason = link.uniqlo ?? link.zara;
  if (reason === 'other-region') return 'other-region';
  if (reason === 'not-a-product') return 'no-link';
  return 'unknown-brand';
}
