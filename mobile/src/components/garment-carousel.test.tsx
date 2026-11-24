import { fireEvent, render, screen } from '@testing-library/react-native';
import { findGarment } from '@choudo/core/domain/garments';

import { GarmentCarousel } from './garment-carousel';

const garments = ['gildan-5000', 'ryo-black-henley', 'ryo-cream-boxy-tee'].map((id) => findGarment(id)!);
const [first, second, third] = garments as [(typeof garments)[0], (typeof garments)[0], (typeof garments)[0]];

async function show(selectedId: string, onSelect = jest.fn()) {
  await render(<GarmentCarousel label="Tops" garments={garments} selectedId={selectedId} onSelect={onSelect} />);
  return onSelect;
}

test('the count says which card is selected', async () => {
  await show(second.id);
  // Hidden from VoiceOver, as the web's aria-hidden: each card says whether it's selected.
  expect(screen.getByText('2 of 3', { includeHiddenElements: true })).toBeTruthy();
});

test('Next selects the next garment; Previous is disabled on the first', async () => {
  const onSelect = await show(first.id);
  expect(screen.getByLabelText('Previous tops').props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByLabelText('Next tops').props.accessibilityState).toMatchObject({ disabled: false });
  await fireEvent.press(screen.getByLabelText('Previous tops'));
  expect(onSelect).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Next tops'));
  expect(onSelect).toHaveBeenCalledWith(second.id);
});

test('Next is disabled on the last', async () => {
  await show(third.id);
  expect(screen.getByLabelText('Next tops').props.accessibilityState).toMatchObject({ disabled: true });
});

test('tapping a card selects it; the selected card says so', async () => {
  const onSelect = await show(first.id);
  const card = screen.getByLabelText(`${third.brand} ${third.name}`);
  expect(card.props.accessibilityState).toMatchObject({ selected: false });
  expect(screen.getByLabelText(`${first.brand} ${first.name}`).props.accessibilityState).toMatchObject({ selected: true });
  await fireEvent.press(card);
  expect(onSelect).toHaveBeenCalledWith(third.id);
});

test('the card that settles in the middle after a swipe is selected', async () => {
  const onSelect = await show(first.id);
  const track = screen.getByTestId('carousel-track');
  const interval = track.props.snapToInterval as number;
  expect(interval).toBeGreaterThan(0);
  await fireEvent(track, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 2 * interval, y: 0 } } });
  expect(onSelect).toHaveBeenCalledWith(third.id);
});

test('settling back on the selected card selects nothing new', async () => {
  const onSelect = await show(second.id);
  const track = screen.getByTestId('carousel-track');
  await fireEvent(track, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: track.props.snapToInterval, y: 0 } } });
  expect(onSelect).not.toHaveBeenCalled();
});

test('the selected card starts in the middle', async () => {
  await show(third.id);
  expect(screen.getByTestId('carousel-track').props.initialScrollIndex).toBe(2);
});
