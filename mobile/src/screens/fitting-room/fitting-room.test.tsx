import { render, screen, within } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { preferenceSpec } from '@choudo/core/domain/fit';
import { GARMENTS } from '@choudo/core/domain/garments';
import { parseProductLink, readyFetchedGarment, uniqloToSeedGarment, type UniqloLink } from '@choudo/core/domain/links';
import sizeChart from '@choudo/core/domain/links/__fixtures__/uniqlo-size-charts-E424873-000.json';
import product from '@choudo/core/domain/links/__fixtures__/uniqlo-product-E424873-000.json';
import { EMPTY_OUTFIT } from '@choudo/core/ui-logic/state/stored';

import { GarmentLookupContext } from '@/hooks/use-fetched';

import { FittingRoom } from '.';

const BODY: BodyInput = { heightCm: 163, weightKg: 56, bodyType: 'womens' };
const link = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/00') as UniqloLink;
const converted = uniqloToSeedGarment(sizeChart, product, link, '2026-11-26');
if (!converted.ok) throw new Error(converted.reason);

test('the worn garment is matched to the carousel by id, not by object: two copies of it show once', async () => {
  // Two separately readied copies of the same fetched tee: the lookup hands out one, the catalogue holds the other.
  const worn = readyFetchedGarment(converted.garment)!;
  const listed = readyFetchedGarment(converted.garment)!;
  expect(worn).not.toBe(listed);
  const errors = jest.spyOn(console, 'error');
  try {
    await render(
      <GestureHandlerRootView>
        <GarmentLookupContext.Provider value={{ find: (id) => (id === worn.id ? worn : GARMENTS.find((g) => g.id === id)), all: [worn, ...GARMENTS], fetched: [] }}>
          <FittingRoom
            body={BODY}
            model={estimateBody(BODY)}
            preference={preferenceSpec(null, null)}
            units="metric"
            onUnitsChange={jest.fn()}
            outfit={{ ...EMPTY_OUTFIT, topId: worn.id, topSize: 'M' }}
            onOutfitChange={jest.fn()}
            catalogue="matching"
            onCatalogueChange={jest.fn()}
            shown={[listed, ...GARMENTS.filter((g) => g.category === 'top' && !g.source.placeholder)]}
            head="cloud"
            onHeadChange={jest.fn()}
            onEditBody={jest.fn()}
            onDetails={jest.fn()}
            onSaveOutfit={jest.fn()}
          />
        </GarmentLookupContext.Provider>
      </GestureHandlerRootView>,
    );
    const carousel = within(screen.getByTestId('carousel-track'));
    expect(carousel.getAllByRole('button', { name: 'Uniqlo Crew Neck T-Shirt' })).toHaveLength(1);
    expect(errors.mock.calls.filter((args) => args.some((a: unknown) => String(a).includes('same key')))).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});
