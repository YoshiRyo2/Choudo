/**
 * Writing one garment's photo landmarks into seed.json as text, so the rest of
 * the file keeps its hand formatting (compact size rows, aligned objects, the
 * _readme). Only that garment's "image" value changes, or is added.
 *
 * Pure: text in, text out. Used by the dev server's save endpoint (vite.config.ts).
 */

import { PANTS_LANDMARKS, TOP_BACK_LANDMARKS, TOP_LANDMARKS, type GarmentImage, type LandmarkName, type PhotoLicence, type PhotoSide } from '../../domain/garments/types';

/** Where a JSON value sits in the text: [start, end). Objects also list their members. */
interface Span {
  start: number;
  end: number;
  members?: { key: string; keyStart: number; value: Span }[];
  items?: Span[];
}

/** A minimal JSON reader that records where every value is. Throws on malformed JSON. */
function locate(text: string): Span {
  let i = 0;
  const ws = () => {
    while (i < text.length && ' \t\r\n'.includes(text[i]!)) i++;
  };
  const fail = (what: string): never => {
    throw new Error(`seed.json: ${what} at offset ${i}`);
  };
  const string = (): string => {
    const start = i;
    i++; // opening quote
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    if (text[i] !== '"') fail('unterminated string');
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  const value = (): Span => {
    ws();
    const start = i;
    const c = text[i];
    if (c === '{') {
      i++;
      const members: NonNullable<Span['members']> = [];
      ws();
      if (text[i] === '}') i++;
      else {
        for (;;) {
          ws();
          if (text[i] !== '"') fail('expected a key');
          const keyStart = i;
          const key = string();
          ws();
          if (text[i] !== ':') fail('expected ":"');
          i++;
          members.push({ key, keyStart, value: value() });
          ws();
          if (text[i] === ',') { i++; continue; }
          if (text[i] === '}') { i++; break; }
          fail('expected "," or "}"');
        }
      }
      return { start, end: i, members };
    }
    if (c === '[') {
      i++;
      const items: Span[] = [];
      ws();
      if (text[i] === ']') i++;
      else {
        for (;;) {
          items.push(value());
          ws();
          if (text[i] === ',') { i++; continue; }
          if (text[i] === ']') { i++; break; }
          fail('expected "," or "]"');
        }
      }
      return { start, end: i, items };
    }
    if (c === '"') {
      string();
      return { start, end: i };
    }
    const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 40));
    if (!m) fail('unexpected character');
    i += m![0].length;
    return { start, end: i };
  };
  const root = value();
  ws();
  if (i !== text.length) fail('trailing text');
  return root;
}

/** The whitespace at the start of the line holding `offset`. */
function indentAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))![0];
}

/**
 * The image value in the seed's house style (as Gildan's row): one landmark per
 * line, each `{ "x": 1, "y": 2 }`, in TOP_LANDMARKS (or PANTS_LANDMARKS) order, whole pixels.
 */
export function formatImage(image: GarmentImage, indent: string, step = '  '): string {
  const a = indent + step;
  const b = a + step;
  // A pants photo's points in PANTS_LANDMARKS order, a top's in TOP_LANDMARKS (or, from the back, TOP_BACK_LANDMARKS) order.
  const names: readonly LandmarkName[] =
    'crotch' in image.landmarks ? PANTS_LANDMARKS : 'neckBack' in image.landmarks ? TOP_BACK_LANDMARKS : TOP_LANDMARKS;
  const points = names.map((name) => {
    const p = image.landmarks[name]!;
    return `${b}${JSON.stringify(name)}: { "x": ${Math.round(p.x)}, "y": ${Math.round(p.y)} }`;
  });
  return [
    '{',
    `${a}"file": ${JSON.stringify(image.file)},`,
    `${a}"licence": ${JSON.stringify(image.licence)},`,
    `${a}"photographedSize": ${JSON.stringify(image.photographedSize)},`,
    `${a}"landmarks": {`,
    points.join(',\n'),
    `${a}}`,
    `${indent}}`,
  ].join('\n');
}

/**
 * The licence a saved photo gets: the one already in seed.json for this file, or
 * `local-only` for a new photo, so it can't ship until someone sets "own" or
 * "brand-permission" in seed.json by hand.
 */
export function licenceForSave(saved: GarmentImage | undefined, file: string): PhotoLicence {
  return saved?.file === file ? saved.licence : 'local-only';
}

/** Members an "image" is added after, when the garment has none yet, best first. */
const INSERT_AFTER = ['color', 'sizing', 'type', 'category', 'name', 'id'];

/**
 * seed.json text with garment `id`'s "image" (or, for the back, "backImage") set
 * to `image`. Everything outside that value is left byte for byte. A new
 * "backImage" goes right after the "image". Throws if the garment isn't there.
 */
export function writeGarmentImage(text: string, id: string, image: GarmentImage, side: PhotoSide = 'front'): string {
  const key = side === 'back' ? 'backImage' : 'image';
  const root = locate(text);
  const garments = root.members?.find((m) => m.key === 'garments')?.value.items;
  if (!garments) throw new Error('seed.json: no "garments" array');
  const garment = garments.find((g) =>
    g.members?.some((m) => m.key === 'id' && JSON.parse(text.slice(m.value.start, m.value.end)) === id),
  );
  if (!garment?.members) throw new Error(`seed.json: no garment with id "${id}"`);

  const existing = garment.members.find((m) => m.key === key);
  if (existing) {
    const formatted = formatImage(image, indentAt(text, existing.keyStart));
    return text.slice(0, existing.value.start) + formatted + text.slice(existing.value.end);
  }
  const after =
    (side === 'back' ? ['image', ...INSERT_AFTER] : INSERT_AFTER).map((k) => garment.members!.find((m) => m.key === k)).find(Boolean) ??
    garment.members[0];
  if (!after) throw new Error(`seed.json: garment "${id}" is empty`);
  const indent = indentAt(text, after.keyStart);
  const insert = `,\n${indent}${JSON.stringify(key)}: ${formatImage(image, indent)}`;
  return text.slice(0, after.value.end) + insert + text.slice(after.value.end);
}
