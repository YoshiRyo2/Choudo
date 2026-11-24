import { render } from '@testing-library/react-native';
import { estimateBody } from '@choudo/core/domain/body';
import type { FitTone } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';
import { HEAD_KINDS, type HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import type { View } from '@choudo/core/ui-logic/components/Mannequin/view';

import { Mannequin, type WornGarment } from './index';
import { byTestId, without, type Node } from './svg-tree';

/**
 * The skin rule (the web skin.test.tsx): the head and face are drawing only. Everything
 * the Mannequin draws outside the head group (body, garments, pins, stand) must be the
 * same tree whichever head or face it wears.
 */

const mens = estimateBody({ heightCm: 182, weightKg: 88, bodyType: 'mens' }).measurements;
const womens = estimateBody({ heightCm: 163, weightKg: 58, bodyType: 'womens' }).measurements;
const wear = (id: string, sizeLabel: string): WornGarment => ({ garment: findGarment(id)!, sizeLabel });

const outfits: { name: string; body: typeof mens; worn: Partial<Record<'top' | 'bottom' | 'onepiece' | 'outer', WornGarment>> }[] = [
  { name: 'bare men’s body', body: mens, worn: {} },
  { name: 'bare women’s body', body: womens, worn: {} },
  { name: 'tee and chinos', body: mens, worn: { top: wear('gildan-5000', 'L'), bottom: wear('fieldline-slim-chino', '34') } },
  {
    name: 'hoodie under a jacket, jeans',
    body: mens,
    worn: { top: wear('gildan-18500', 'L'), bottom: wear('corvo-relaxed-jean', '34x32'), outer: wear('port-authority-j317', 'L') },
  },
  { name: 'dress', body: womens, worn: { onepiece: wear('landsend-surplice-dress', 'M') } },
  { name: 'skirt and tee', body: womens, worn: { top: wear('landsend-super-t', 'S'), bottom: wear('landsend-a-line-skirt', '8') } },
];

async function tree(o: (typeof outfits)[number], head: HeadKind, face: FitTone, view: View) {
  const r = await render(<Mannequin body={o.body} {...o.worn} head={head} face={face} view={view} frame="body" />);
  const json = r.toJSON() as unknown as Node;
  await r.unmount();
  return json;
}

/** The tree as text (handlers such as onLayout are new functions on every render, so they're left out). */
const serial = (t: unknown) => JSON.stringify(t);

describe('the skin rule', () => {
  for (const o of outfits) {
    for (const view of ['front', 'back'] as const) {
      test(`the same body and garments under every head and face: ${o.name}, ${view}`, async () => {
        for (const g of Object.values(o.worn)) expect(g?.garment).toBeTruthy();
        const reference = serial(without(await tree(o, 'cloud', 'unknown', view), 'mascot-head'));
        expect(reference).toContain('RNSVGPath');
        for (const head of HEAD_KINDS) {
          for (const face of ['good', 'warn', 'bad', 'unknown'] as const) {
            const t = await tree(o, head, face, view);
            expect(byTestId(t, 'mascot-head')).toBeDefined();
            expect(serial(without(t, 'mascot-head'))).toBe(reference);
          }
        }
      });
    }
  }

  test('each kind draws a different head (the test above is not comparing nothing)', async () => {
    const heads: string[] = [];
    for (const h of HEAD_KINDS) heads.push(serial(byTestId(await tree(outfits[0]!, h, 'good', 'front'), 'mascot-head')));
    expect(new Set(heads).size).toBe(HEAD_KINDS.length);
  });

  test('no face from the back', async () => {
    const t = await tree(outfits[0]!, 'bunny', 'good', 'back');
    expect(byTestId(t, 'mascot-face')).toBeUndefined();
  });
});
