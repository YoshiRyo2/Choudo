/**
 * A Uniqlo product's cut from its details tags: sleeve, fit intent and neckline. Pure.
 *
 * Tags look like `{ group: "top-fit", tag: "regular", tagName: "Regular" }`. Groups and
 * values seen across 30 US tops (27 Nov 2026):
 *   top-fit   very-fitted, fitted, regular, relaxed, oversized
 *   sleeve    short, long, half, 8-10, sleeveless
 *   neck-type crew-neck, henley-neck, boat-neck, high-neck (V-neck and scoop-neck products
 *             had no neck tag, so the product name is read too)
 */

import type { FitIntent, Neckline } from '../garments';

export interface UniqloCut {
  sleeve: 'short' | 'long';
  /** The sleeve tag's words when it's neither short nor long ("Sleeveless", "Half", "8/10"): drawn short. */
  otherSleeve?: string;
  /**
   * What the fit tag says, as a fit intent (Very Fitted / Fitted → slim). Shown, not used for
   * sizing yet: the engine aims an oversized design at more room, so on the same chart it would
   * pick a size up (decided 27 Nov 2026: link garments stay "regular" until that's reviewed).
   */
  fit: FitIntent;
  /** Unset when neither a tag nor the name says (drawn as a crew neck). */
  neckline?: Neckline;
  /** The tags as Uniqlo words them, for the result card: "Crew Neck · Short sleeve · Regular fit". */
  text: string | null;
}

interface Tag {
  group: string;
  tag: string;
  tagName: string;
}

const FIT: Readonly<Record<string, FitIntent>> = {
  'very-fitted': 'slim',
  fitted: 'slim',
  slim: 'slim',
  regular: 'regular',
  relaxed: 'relaxed',
  oversized: 'oversized',
};

const NECK: Readonly<Record<string, Neckline>> = {
  'crew-neck': 'crew',
  'v-neck': 'v',
  'scoop-neck': 'scoop',
  'u-neck': 'scoop',
  'mock-neck': 'mock',
  'high-neck': 'mock',
  turtleneck: 'mock',
  'henley-neck': 'henley',
  henley: 'henley',
  'boat-neck': 'boat',
};

/** Name words → neckline, for products without a neck tag. First match wins. */
const NECK_IN_NAME: readonly [RegExp, Neckline][] = [
  [/\bv[\s-]?neck/i, 'v'],
  [/\bscoop[\s-]?neck|\bu[\s-]?neck/i, 'scoop'],
  [/\bhenley/i, 'henley'],
  [/\bboat[\s-]?neck/i, 'boat'],
  [/\bmock[\s-]?neck|\bhigh[\s-]?neck|\bturtle[\s-]?neck/i, 'mock'],
  [/\bcrew[\s-]?neck/i, 'crew'],
];

const LONG_SLEEVE_IN_NAME = /\blong[\s-]*sleeve/i;

function tagsOf(raw: unknown): Tag[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is Tag =>
      typeof t === 'object' && t !== null && typeof t.group === 'string' && typeof t.tag === 'string' && typeof t.tagName === 'string',
  );
}

/** The cut of a product from its `tags` (details JSON) and its name. Missing tags fall back to the name, then to regular / short / crew. */
export function uniqloCut(tagsRaw: unknown, name: string): UniqloCut {
  const tags = tagsOf(tagsRaw);
  const tag = (group: string) => tags.find((t) => t.group === group);
  const fitTag = tag('top-fit');
  const sleeveTag = tag('sleeve');
  const neckTag = tag('neck-type');

  const cut: UniqloCut = { sleeve: 'short', fit: (fitTag && FIT[fitTag.tag]) || 'regular', text: null };
  if (sleeveTag?.tag === 'long') cut.sleeve = 'long';
  else if (sleeveTag && sleeveTag.tag !== 'short') cut.otherSleeve = sleeveTag.tagName;
  else if (!sleeveTag && LONG_SLEEVE_IN_NAME.test(name)) cut.sleeve = 'long';

  const neckline = (neckTag && NECK[neckTag.tag]) ?? NECK_IN_NAME.find(([re]) => re.test(name))?.[1];
  if (neckline) cut.neckline = neckline;

  const words = [
    neckTag?.tagName,
    sleeveTag && (/sleeve/i.test(sleeveTag.tagName) ? sleeveTag.tagName : `${sleeveTag.tagName} sleeve`),
    fitTag && (/fit/i.test(fitTag.tagName) ? fitTag.tagName : `${fitTag.tagName} fit`),
  ].filter((w): w is string => !!w);
  cut.text = words.length > 0 ? words.join(' · ') : null;
  return cut;
}
