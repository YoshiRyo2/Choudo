import { fireEvent, render, screen } from '@testing-library/react-native';
import { estimateBody, INPUT_LIMITS, type BodyType } from '@choudo/core/domain/body';
import { fitGarment } from '@choudo/core/domain/fit';
import { findGarment, topLandmarks } from '@choudo/core/domain/garments';
import { bodyGeometry } from '@choudo/core/ui-logic/components/Mannequin/geometry';
import { warpPieces } from '@choudo/core/ui-logic/components/Mannequin/photoWarp';
import { topShape } from '@choudo/core/ui-logic/components/Mannequin/topShape';

import { Mannequin, type WornGarment } from './index';
import { paint } from './paint';
import { brush, byTestId, nodes, type Node } from './svg-tree';

const mensModel = estimateBody({ heightCm: 182, weightKg: 88, bodyType: 'mens' });
const mens = mensModel.measurements;
const wear = (id: string, sizeLabel: string): WornGarment => ({ garment: findGarment(id)!, sizeLabel });

async function draw(props: Partial<React.ComponentProps<typeof Mannequin>> = {}) {
  const r = await render(<Mannequin body={mens} {...props} />);
  return r.toJSON() as unknown as Node;
}

const svgOf = (tree: Node) => nodes(tree, 'RNSVGSvgView')[0]!;
const pathDs = (tree: Node) => nodes(tree, 'RNSVGPath').map((p) => p.props.d);

test('the body is drawn from bodyGeometry, every path unchanged', async () => {
  const tree = await draw();
  const g = bodyGeometry(mens);
  const ds = pathDs(tree);
  expect(ds).toContain(g.paths.torso);
  expect(ds).toContain(g.paths.arms[0]);
  expect(ds).toContain(g.paths.arms[1]);
});

test('a tee is drawn from topShape unchanged; its local-only photo is not drawn', async () => {
  const tee = wear('gildan-5000', 'L');
  const tree = await draw({ top: tee });
  const shape = topShape(bodyGeometry(mens), tee.garment, tee.garment.sizes.find((s) => s.label === 'L')!.measurements, mens.chestCm, mens, {
    view: 'front',
  });
  const ds = pathDs(tree);
  for (const d of [shape.body, ...shape.sleeves]) expect(ds).toContain(d);
  expect(nodes(tree, 'RNSVGImage')).toHaveLength(0);
});

test('a photo top is warped: one image per warp piece', async () => {
  const henley = wear('ryo-black-henley', 'Mine');
  const tree = await draw({ top: henley });
  const shape = topShape(bodyGeometry(mens), henley.garment, henley.garment.sizes[0]!.measurements, mens.chestCm, mens, { view: 'front' });
  const pieces = warpPieces(topLandmarks(henley.garment.image!, 'front')!, shape.landmarks, shape.sleeveEdges);
  expect(pieces.length).toBeGreaterThan(0);
  // The photo is one image (loaded and decoded once), drawn into each triangle by a <Use>.
  expect(nodes(tree, 'RNSVGImage')).toHaveLength(1);
  expect(nodes(tree, 'RNSVGUse')).toHaveLength(pieces.length);
  const first = pieces[0]!.transform;
  expect(nodes(tree, 'RNSVGUse')[0]!.props.matrix).toEqual([first.a, first.b, first.c, first.d, first.e, first.f]);
});

test("a photo whose licence doesn't allow warping is never warped, even with photos='all'", async () => {
  const henley = findGarment('ryo-black-henley')!;
  const affiliate = { ...henley, image: { ...henley.image!, licence: 'affiliate-unaltered' as const } };
  const tree = await draw({ top: { garment: affiliate, sizeLabel: 'Mine' }, photos: 'all' });
  expect(nodes(tree, 'RNSVGImage')).toHaveLength(0);
});

test('from the back the henley has no back photo: flat colour, no images', async () => {
  const tree = await draw({ top: wear('ryo-black-henley', 'Mine'), view: 'back' });
  expect(nodes(tree, 'RNSVGImage')).toHaveLength(0);
});

test("photos: 'all' still can't draw a photo that isn't bundled", async () => {
  const tree = await draw({ top: wear('gildan-5000', 'L'), photos: 'all' });
  expect(nodes(tree, 'RNSVGImage')).toHaveLength(0);
});

test('fit pins: one per zone with a marker, coloured by tone', async () => {
  const tee = wear('gildan-5000', 'L');
  const fit = fitGarment(mensModel, tee.garment, 'L');
  const tree = await draw({ top: { ...tee, fit } });
  const shape = topShape(bodyGeometry(mens), tee.garment, tee.garment.sizes.find((s) => s.label === 'L')!.measurements, mens.chestCm, mens, {
    view: 'front',
  });
  const marked = fit.zones.filter((z) => shape.markers[z.zone as keyof typeof shape.markers]);
  expect(marked.length).toBeGreaterThan(0);
  const pins = nodes(tree).filter((n) => String(n.props.testID ?? '').startsWith('pin-'));
  expect(pins).toHaveLength(marked.length);
  for (const z of marked) {
    const pin = byTestId(tree, `pin-top-${z.zone}`)!;
    expect(nodes(pin, 'RNSVGCircle')[0]!.props.fill).toEqual(brush(paint.pin[z.tone].circle.fill));
  }
});

test('showFit={false} draws no pins', async () => {
  const tee = wear('gildan-5000', 'L');
  const tree = await draw({ top: { ...tee, fit: fitGarment(mensModel, tee.garment, 'L') }, showFit: false });
  expect(nodes(tree).filter((n) => String(n.props.testID ?? '').startsWith('pin-'))).toHaveLength(0);
});

test('a size label the garment does not have (a stale outfit) draws the bare body', async () => {
  const bare = svgOf(await draw());
  for (const slot of ['top', 'bottom', 'onepiece', 'outer'] as const) {
    const id = { top: 'gildan-5000', bottom: 'fieldline-slim-chino', onepiece: 'landsend-surplice-dress', outer: 'port-authority-j317' }[slot];
    expect(svgOf(await draw({ [slot]: wear(id, 'no-such-size') }))).toEqual(bare);
  }
});

test('the accessibility label is the web wording', async () => {
  const top = wear('gildan-5000', 'L');
  const bottom = wear('fieldline-slim-chino', '34');
  await render(<Mannequin body={mens} top={top} bottom={bottom} />);
  const label = `Mannequin, 182 cm tall wearing Gildan Heavy Cotton T-Shirt (5000) in L and Fieldline Slim Chino in 34`;
  expect(screen.getByLabelText(label)).toBeTruthy();
  expect(screen.getByRole('image')).toBeTruthy();
});

test('the label says when it is seen from the back', async () => {
  await render(<Mannequin body={mens} view="back" />);
  expect(screen.getByLabelText('Mannequin, 182 cm tall, seen from the back,')).toBeTruthy();
});

test('the view box: 124 wide from −62, from −6; the canvas fits 204 cm, the body frame ends under the feet', async () => {
  const canvas = svgOf(await draw());
  expect([canvas.props.minX, canvas.props.minY, canvas.props.vbWidth, canvas.props.vbHeight]).toEqual([-62, -6, 124, 214]);
  expect(svgOf(await draw({ frame: 'body' })).props.vbHeight).toBe(192);
  expect(canvas.props.align).toBe('xMidYMid');
});

test('the tape can be turned off', async () => {
  expect(byTestId(await draw(), 'height-tape')).toBeDefined();
  expect(byTestId(await draw({ showHeightTape: false }), 'height-tape')).toBeUndefined();
});

test('outline widths follow the drawn width: 2.2 pt at 124 pt wide, 1.1 at 248', async () => {
  const torsoWidth = async (width: number, height: number) => {
    const r = await render(<Mannequin body={mens} />);
    await fireEvent(r.getByRole('image'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
    const torso = nodes(r.toJSON() as unknown as Node, 'RNSVGPath').find((p) => p.props.d === bodyGeometry(mens).paths.torso)!;
    await r.unmount();
    return torso.props.strokeWidth as number;
  };
  expect(await torsoWidth(124, 214)).toBeCloseTo(2.2);
  expect(await torsoWidth(248, 428)).toBeCloseTo(1.1);
  // A box wider than the figure: it's drawn to the height (xMidYMid meet), 124 pt wide.
  expect(await torsoWidth(400, 214)).toBeCloseTo(2.2);
});

describe('bodies at the input limits stay inside the view box', () => {
  const cases: [BodyType, number, number][] = [
    ['mens', INPUT_LIMITS.heightCm.min, 30],
    ['mens', INPUT_LIMITS.heightCm.max, 150],
    ['womens', INPUT_LIMITS.heightCm.min, 30],
    ['womens', INPUT_LIMITS.heightCm.max, 150],
  ];
  test.each(cases)('%s, %i cm', async (bodyType, heightCm, weightKg) => {
    const body = estimateBody({ heightCm, weightKg, bodyType }).measurements;
    for (const frame of ['canvas', 'body'] as const) {
      const tree = (await render(<Mannequin body={body} frame={frame} />)).toJSON() as unknown as Node;
      const vb = svgOf(tree).props as { minX: number; minY: number; vbWidth: number; vbHeight: number };
      const bottom = vb.minY + vb.vbHeight;
      for (const foot of bodyGeometry(body).paths.feet) {
        expect(foot.cy + foot.ry).toBeLessThanOrEqual(bottom);
        expect(foot.cx - foot.rx).toBeGreaterThanOrEqual(vb.minX);
        expect(foot.cx + foot.rx).toBeLessThanOrEqual(vb.minX + vb.vbWidth);
      }
      const strip = nodes(byTestId(tree, 'height-tape')!, 'RNSVGRect')[0]!.props as { y: number; height: number };
      expect(strip.y).toBeGreaterThanOrEqual(vb.minY);
      expect(strip.y + strip.height).toBeLessThanOrEqual(bottom);
    }
  });
});
