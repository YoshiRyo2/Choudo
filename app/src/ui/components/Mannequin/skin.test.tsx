import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../domain/body';
import type { FitTone } from '../../../domain/fit';
import { findGarment } from '../../../domain/garments';
import { HEAD_KINDS, type HeadKind } from './heads';
import { Mannequin, type WornGarment } from './Mannequin';
import type { View } from './view';

/**
 * The skin rule: the head, face and motion are drawing only. Everything the
 * Mannequin draws outside the head group (body, garments, pins, stand) must be the
 * same markup whichever head or face it wears.
 */

const mens = estimateBody({ heightCm: 182, weightKg: 88, bodyType: 'mens' }).measurements;
const womens = estimateBody({ heightCm: 163, weightKg: 58, bodyType: 'womens' }).measurements;
const wear = (id: string, sizeLabel: string): WornGarment => ({ garment: findGarment(id)!, sizeLabel });

const outfits: { name: string; body: typeof mens; worn: Partial<Record<'top' | 'bottom' | 'onepiece' | 'outer', WornGarment>> }[] = [
  { name: 'bare men’s body', body: mens, worn: {} },
  { name: 'bare women’s body', body: womens, worn: {} },
  { name: 'tee and chinos', body: mens, worn: { top: wear('gildan-5000', 'L'), bottom: wear('fieldline-slim-chino', '34') } },
  { name: 'hoodie under a jacket, jeans', body: mens, worn: { top: wear('gildan-18500', 'L'), bottom: wear('corvo-relaxed-jean', '34x32'), outer: wear('port-authority-j317', 'L') } },
  { name: 'dress', body: womens, worn: { onepiece: wear('landsend-surplice-dress', 'M') } },
  { name: 'skirt and tee', body: womens, worn: { top: wear('landsend-super-t', 'S'), bottom: wear('landsend-a-line-skirt', '8') } },
];

function markup(o: (typeof outfits)[number], head: HeadKind, face: FitTone, view: View) {
  return renderToStaticMarkup(<Mannequin body={o.body} {...o.worn} head={head} face={face} view={view} frame="body" />);
}

/** The markup with the head group cut out (it has no nested <g> of its own kind, so the depth count finds its end). */
function withoutHead(html: string): string {
  const start = html.indexOf('<g class="mascot-head');
  if (start < 0) throw new Error('No head drawn');
  let depth = 0;
  const tag = /<\/?g\b[^>]*>/g;
  tag.lastIndex = start;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : m[0].endsWith('/>') ? 0 : 1;
    if (depth === 0) return html.slice(0, start) + html.slice(m.index + m[0].length);
  }
  throw new Error('Unclosed head group');
}

describe('the skin rule', () => {
  for (const o of outfits) {
    for (const view of ['front', 'back'] as const) {
      it(`draws the same body and garments under every head and face: ${o.name}, ${view}`, () => {
        for (const g of Object.values(o.worn)) expect(g?.garment, 'garment in the seed').toBeTruthy();
        const reference = withoutHead(markup(o, 'cloud', 'unknown', view));
        expect(reference).toContain('mannequin__form');
        // Every garment worn is drawn (a bad size label would quietly draw nothing).
        const drawn = reference.match(/class="mannequin__garment/g)?.length ?? 0;
        expect(drawn >= Object.keys(o.worn).length).toBe(true);
        for (const head of HEAD_KINDS) {
          for (const face of ['good', 'warn', 'bad', 'unknown'] as const) {
            const html = markup(o, head, face, view);
            expect(html).toContain(`data-head="${head}"`);
            expect(withoutHead(html)).toBe(reference);
          }
        }
      });
    }
  }

  it('actually draws a different head for each kind (the test above is not comparing nothing)', () => {
    const heads = HEAD_KINDS.map((head) => markup(outfits[0]!, head, 'good', 'front'));
    expect(new Set(heads).size).toBe(HEAD_KINDS.length);
  });

  it('draws no face from the back', () => {
    expect(markup(outfits[0]!, 'bunny', 'good', 'back')).toContain('data-face="none"');
    expect(markup(outfits[0]!, 'bunny', 'good', 'back')).not.toContain('mascot-face');
  });
});
