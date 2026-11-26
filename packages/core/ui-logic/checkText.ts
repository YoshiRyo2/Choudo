/**
 * The Check tab's wording ("What size should I buy?"): paste a product link, get a size.
 * Errors say what happened and the next step, never whose fault it was.
 */

import type { ProductLink } from '../domain/links';

export const CHECK_TEXT = {
  title: 'What size should I buy?',
  field: 'Paste a Uniqlo link',
  paste: 'Paste',
  submit: 'Check size',
  scope: 'Works with Uniqlo US tops for now.',
  loading: 'Reading Uniqlo’s size chart…',
  retry: 'Retry',
  tryOn: 'Try it on',
  openAt: 'Open at Uniqlo',
  recent: 'Recent checks',
  fromLink: 'From your link',
  unsupportedHosts: 'Unsupported hosts',
} as const;

/** Why a check didn't give a size. */
export type CheckError =
  | 'no-link'
  | 'unknown-brand'
  | 'other-region'
  | 'network'
  | 'not-found'
  | 'unsupported-parts'
  | 'no-sizes'
  | 'bad-response';

const ERROR_TEXT: Record<CheckError, string> = {
  'no-link': 'Paste a product link from uniqlo.com.',
  'unknown-brand': 'Choudo can read Uniqlo links for now. More brands soon.',
  'other-region': 'Only Uniqlo US links for now.',
  network: 'Couldn’t reach Uniqlo. Check your connection and try again.',
  'not-found': 'Uniqlo has no product at this link. Paste another product link.',
  'unsupported-parts': 'Choudo can only check tops from Uniqlo for now.',
  'no-sizes': 'Uniqlo doesn’t list garment measurements for this product. Try another one.',
  'bad-response': 'Couldn’t read Uniqlo’s size chart. Try again in a moment.',
};

export const checkErrorText = (error: CheckError): string => ERROR_TEXT[error];

/** Errors a second try might fix: they get a Retry button. */
export const canRetry = (error: CheckError): boolean => error === 'network' || error === 'bad-response';

/**
 * Why a pasted text isn't a link Choudo can read, or null when it is one (a Uniqlo US
 * product page). A uniqlo.com page that isn't a product gets the "paste a product link" line.
 */
export function linkError(link: ProductLink | null): CheckError | null {
  if (link === null) return 'no-link';
  if (link.brand === 'uniqlo') return null;
  if (link.uniqlo === 'other-region') return 'other-region';
  if (link.uniqlo === 'not-a-product') return 'no-link';
  return 'unknown-brand';
}
