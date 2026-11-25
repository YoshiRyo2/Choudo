/// <reference types="node" />
// Reads files on disk (the test runs in Node, not on the phone).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const MOBILE = join(__dirname, '../..');
const CORE = join(MOBILE, '../packages/core');
const FONTS = join(MOBILE, 'assets/fonts');
const FILES = ['MPLUSRounded1c-Medium.ttf', 'MPLUSRounded1c-Bold.ttf', 'MPLUSRounded1c-ExtraBold.ttf'];

// opentype.js ships no types: just what this test reads.
const opentype = require('opentype.js') as { parse: (buffer: ArrayBuffer) => { charToGlyphIndex: (ch: string) => number } };

function filesUnder(dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path, keep) : keep(path) ? [path] : [];
  });
}

/** VoiceOver reads these; they're never drawn, so they needn't be in the font. */
const SPOKEN = new Set(['accessibilityLabel', 'accessibilityHint']);

/** Every character a source file can put on screen: string literals and JSX text, not comments or spoken labels. */
function shownText(file: string): string {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let text = '';
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && SPOKEN.has(node.name.getText())) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node) || ts.isJsxText(node)) text += node.text;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return text;
}

const isSource = (path: string) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.includes(`${join('src', 'tests')}`);
const sources = [
  // stampGlyphs.ts is generated outline data, drawn as paths, not text.
  ...filesUnder(join(CORE, 'ui-logic'), (p) => isSource(p) && !p.endsWith('stampGlyphs.ts')),
  ...filesUnder(join(MOBILE, 'src'), isSource),
];
const seed = JSON.parse(readFileSync(join(CORE, 'domain/garments/seed.json'), 'utf8')) as { brand: string; name: string }[] | { garments: { brand: string; name: string }[] };
const rows = Array.isArray(seed) ? seed : seed.garments;

/** Where each character on screen comes from. */
const used = new Map<string, string>();
for (const file of sources) for (const ch of shownText(file)) if (!used.has(ch)) used.set(ch, relative(MOBILE, file));
for (const r of rows) for (const ch of r.brand + r.name) if (!used.has(ch)) used.set(ch, `seed.json: ${r.brand} ${r.name}`);

test.each(FILES)('%s has every character the app draws', (file) => {
  const font = opentype.parse(new Uint8Array(readFileSync(join(FONTS, file))).buffer);
  const missing = [...used].filter(([ch]) => !/\s/.test(ch) && font.charToGlyphIndex(ch) === 0).map(([ch, from]) => `${JSON.stringify(ch)} (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}) from ${from}`);
  expect(missing).toEqual([]);
});

test.each(FILES)('%s is a Latin subset, under 400 KB', (file) => {
  expect(statSync(join(FONTS, file)).size).toBeLessThan(400 * 1024);
});

test('the font licence ships next to the files', () => {
  expect(readFileSync(join(FONTS, 'OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE');
});

test('the copy is really collected (curly quotes, arrows, a brand’s é)', () => {
  for (const ch of ['’', '“', '→', '·', '−', 'é']) expect(used.has(ch)).toBe(true);
});
