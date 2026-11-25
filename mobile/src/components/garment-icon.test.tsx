import { fireEvent, render } from '@testing-library/react-native';
import { findGarment } from '@choudo/core/domain/garments';

import { GarmentIcon } from './garment-icon';
import { nodes, type Node } from './mannequin/svg-tree';

const draw = async (id: string) => (await render(<GarmentIcon garment={findGarment(id)!} />)).toJSON() as unknown as Node;

test('a garment with a bundled own photo shows the photo', async () => {
  const tree = await draw('ryo-black-henley');
  expect(nodes(tree, 'Image')).toHaveLength(1);
  expect(nodes(tree, 'RNSVGPath')).toHaveLength(0);
});

test('a local-only photo (Gildan 5000) draws the flat icon instead', async () => {
  const tree = await draw('gildan-5000');
  expect(nodes(tree, 'Image')).toHaveLength(0);
  expect(nodes(tree, 'RNSVGPath')).toHaveLength(1);
});

test('a photo that fails to load falls back to the drawing', async () => {
  const r = await render(<GarmentIcon garment={findGarment('ryo-black-henley')!} />);
  await fireEvent(r.getByTestId('garment-photo'), 'error');
  const tree = r.toJSON() as unknown as Node;
  expect(nodes(tree, 'Image')).toHaveLength(0);
  expect(nodes(tree, 'RNSVGPath').length).toBeGreaterThan(0);
});
