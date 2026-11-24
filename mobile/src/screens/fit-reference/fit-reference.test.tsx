import { fireEvent, render, screen } from '@testing-library/react-native';
import { canAnchor, type Anchor, type FitStyle } from '@choudo/core/domain/fit';
import { GARMENTS } from '@choudo/core/domain/garments';
import { teeFormToAnchor } from '@choudo/core/ui-logic/screens/anchorForm';

import { FitReferenceScreen } from './index';

const TEES = GARMENTS.filter(canAnchor);
const LAST_TEE = TEES[TEES.length - 1];

async function renderScreen(anchor: Anchor | null = null, style: FitStyle | null = null) {
  const onDone = jest.fn();
  const onSkip = jest.fn();
  await render(
    <FitReferenceScreen
      units="metric"
      anchor={anchor}
      style={style}
      onDone={onDone}
      onSkip={onSkip}
      skipLabel="Skip for now"
    />,
  );
  return { onDone, onSkip };
}

const heading = (text: string) => screen.getByRole('header', { name: text });
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

test('anchorable tees exist (the catalogue step has something to show)', () => {
  expect(TEES.length).toBeGreaterThan(0);
});

test('no reference: opens on the three ways in', async () => {
  await renderScreen();
  expect(heading('Got a tee that fits the way you like?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Pick it from our tees' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Measure it' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ask me a question instead' })).toBeTruthy();
});

test('a catalogue anchor opens on its step', async () => {
  await renderScreen({ kind: 'catalogue', garmentId: TEES[0].id, size: TEES[0].sizes[0].label });
  expect(heading('Which tee, and what size?')).toBeTruthy();
});

test('a measured anchor opens on Measure your tee, filled in', async () => {
  await renderScreen({ kind: 'measured', chestFlatCm: 52, lengthCm: 72 });
  expect(heading('Measure your tee')).toBeTruthy();
  expect(screen.getByLabelText('Chest width').props.value).toBe('52');
});

test('a stated style opens on the question', async () => {
  await renderScreen(null, 'slim');
  expect(heading('How do you like tees to fit?')).toBeTruthy();
});

test('a catalogue anchor for a tee we no longer list opens on the three ways in', async () => {
  await renderScreen({ kind: 'catalogue', garmentId: 'gone-tee', size: 'M' });
  expect(heading('Got a tee that fits the way you like?')).toBeTruthy();
});

test('catalogue: Save does nothing until a size is picked, then saves the tee and size', async () => {
  const { onDone } = await renderScreen(null, 'relaxed');
  await press('Back');
  await press('Pick it from our tees');
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();
  await fireEvent.press(save);
  expect(onDone).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('radio', { name: `${LAST_TEE.brand} ${LAST_TEE.name}` }));
  const size = LAST_TEE.sizes[0].label;
  await fireEvent.press(screen.getByRole('radio', { name: size }));
  expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  await press('Save');
  expect(onDone).toHaveBeenCalledWith({ kind: 'catalogue', garmentId: LAST_TEE.id, size }, 'relaxed');
});

test('measure: an empty Save asks for both numbers; valid ones save the measured tee', async () => {
  const { onDone } = await renderScreen();
  await press('Measure it');
  await press('Save');
  expect(screen.getByText('Enter both numbers to continue.')).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Chest width'), '52');
  await fireEvent.changeText(screen.getByLabelText('Length'), '72,5');
  await press('Save');
  const expected = teeFormToAnchor({ chest: '52', length: '72,5' }, 'metric').anchor;
  expect(onDone).toHaveBeenCalledWith(expected, null);
});

test('style: picking one and saving clears the anchor', async () => {
  const { onDone } = await renderScreen({ kind: 'measured', chestFlatCm: 52, lengthCm: 72 });
  await press('Back');
  await press('Ask me a question instead');
  await fireEvent.press(screen.getByRole('radio', { name: /^Relaxed/ }));
  await press('Save');
  expect(onDone).toHaveBeenCalledWith(null, 'relaxed');
});

test('the skip button leaves without saving', async () => {
  const { onDone, onSkip } = await renderScreen();
  await press('Skip for now');
  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(onDone).not.toHaveBeenCalled();
});

test('the tee diagram draws', async () => {
  await renderScreen();
  await press('Measure it');
  expect(screen.getByTestId('tee-diagram', { includeHiddenElements: true })).toBeTruthy();
});

test('a tee we no longer list plus a stated style opens on the question', async () => {
  await renderScreen({ kind: 'catalogue', garmentId: 'gone-tee', size: 'M' }, 'slim');
  expect(heading('How do you like tees to fit?')).toBeTruthy();
});

test('a tee we no longer list: Pick it from our tees starts on the first tee we list, with its sizes', async () => {
  await renderScreen({ kind: 'catalogue', garmentId: 'gone-tee', size: 'M' });
  await press('Pick it from our tees');
  expect(screen.getByRole('radio', { name: `${TEES[0].brand} ${TEES[0].name}` })).toBeChecked();
  expect(screen.getByRole('radio', { name: TEES[0].sizes[0].label })).toBeTruthy();
});
