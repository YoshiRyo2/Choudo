import { render } from '@testing-library/react-native';
import Svg from 'react-native-svg';
import { faceShape, HEAD_KINDS, headShape } from '@choudo/core/ui-logic/components/Mannequin/heads';

import { colors } from '@/theme';

import { HeightTape } from './height-tape';
import { MascotHead, MascotHeadIcon } from './mascot-head';
import { brush, byTestId, nodes } from './svg-tree';

const at = { x: 0, bottom: 0, w: 10 };

const head = async (props: Partial<React.ComponentProps<typeof MascotHead>> = {}) => {
  const r = await render(
    <Svg viewBox="-30 -40 60 45">
      <MascotHead kind="cloud" face="unknown" at={at} unit={1} {...props} />
    </Svg>,
  );
  return byTestId(r.toJSON() as never, 'mascot-head')!;
};

test.each(HEAD_KINDS)('%s: a halo circle and a fill circle per puff', async (kind) => {
  const g = await head({ kind, face: null });
  expect(nodes(g, 'RNSVGCircle')).toHaveLength(headShape(kind, at).puffs.length * 2);
});

test('the peach is filled peach; the others white', async () => {
  const fills = async (kind: 'cloud' | 'peach') =>
    nodes(byTestId(await head({ kind, face: null }), 'mascot-head-fill')!, 'RNSVGCircle').map((c) => c.props.fill);
  for (const fill of await fills('peach')) expect(fill).toEqual(brush(colors.brand));
  for (const fill of await fills('cloud')) expect(fill).toEqual(brush(colors.surface));
});

test('no face from the back: no eyes, no mouth', async () => {
  const g = await head({ face: null });
  expect(byTestId(g, 'mascot-face')).toBeUndefined();
  expect(nodes(g, 'RNSVGEllipse')).toHaveLength(0);
});

test('a bad fit draws the frown', async () => {
  const g = await head({ face: 'bad' });
  const mouth = faceShape('bad', headShape('cloud', at).puffs[0]!).mouthPath;
  expect(nodes(g, 'RNSVGPath').map((p) => p.props.d)).toContain(mouth);
});

test('bunny ears, peach leaf and crease are drawn', async () => {
  const bunny = await head({ kind: 'bunny', face: null });
  expect(nodes(bunny, 'RNSVGEllipse')).toHaveLength(4);
  const peach = await head({ kind: 'peach', face: null });
  const shape = headShape('peach', at);
  expect(nodes(peach, 'RNSVGPath').map((p) => p.props.d)).toEqual([shape.leaf, shape.crease]);
});

test('outline widths are screen points: 4.4 halo at unit 1, half that at unit 0.5', async () => {
  const halo = async (unit: number) => nodes(byTestId(await head({ unit }), 'mascot-head-halo')!, 'RNSVGCircle')[0]!.props.strokeWidth;
  expect(await halo(1)).toBe(4.4);
  expect(await halo(0.5)).toBe(2.2);
});

test('the icon is 30 × 31 with the lighter halo and a happy face', async () => {
  const r = await render(<MascotHeadIcon kind="cloud" />);
  const tree = r.toJSON() as never;
  const svg = nodes(tree, 'RNSVGSvgView')[0]!;
  expect([svg.props.minX, svg.props.minY, svg.props.vbWidth, svg.props.vbHeight]).toEqual([-15, -29.5, 30, 31]);
  expect(nodes(byTestId(tree, 'mascot-head-halo')!, 'RNSVGCircle')[0]!.props.strokeWidth).toBe(3);
  expect(nodes(tree, 'RNSVGPath').map((p) => p.props.d)).toContain(faceShape('good', headShape('cloud', { x: 0, bottom: 0, w: 10 }).puffs[0]!).mouthPath);
});

describe('HeightTape', () => {
  const tape = async (heightCm: number) => {
    const r = await render(
      <Svg viewBox="-62 -6 124 214">
        <HeightTape heightCm={heightCm} x={-59} />
      </Svg>,
    );
    return r.toJSON() as never;
  };
  const texts = (tree: never) => nodes(tree, 'RNSVGTSpan').map((t) => t.props.content);

  test('numbers every 20 cm up to the height, and the reading', async () => {
    const tree = await tape(170.4);
    expect(texts(tree)).toEqual(['20', '40', '60', '80', '100', '120', '140', '160', '170 cm']);
  });

  test('a tick every 2 cm from the floor while it stays on the canvas', async () => {
    const tree = await tape(170);
    // 0..174 every 2 cm (the last at y = −4, the canvas's top edge) = 88 ticks, plus the height mark.
    expect(nodes(tree, 'RNSVGLine')).toHaveLength(88 + 1);
  });

  test('text in the bold rounded face', async () => {
    const tree = await tape(170);
    const font = nodes(tree, 'RNSVGText')[0]!.props.font as { fontFamily: string; fontSize: number };
    expect(font).toEqual(expect.objectContaining({ fontFamily: 'MPLUSRounded1c_700Bold', fontSize: 2.6 }));
  });
});
