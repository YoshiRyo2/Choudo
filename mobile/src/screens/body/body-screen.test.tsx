import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { EMPTY_FORM, switchUnits } from '@choudo/core/ui-logic/screens/bodyForm';
import { fieldErrors } from '@choudo/core/ui-logic/screens/bodyFieldErrors';

import { BodyScreen, type BodyScreenProps } from './index';

const MISSING = 'Enter your height and weight to continue.';

async function renderScreen(props: Partial<BodyScreenProps> = {}) {
  const onDone = jest.fn();
  await render(<BodyScreen initial={null} units="metric" onDone={onDone} {...props} />);
  return { onDone };
}

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

test('an empty form: the button says what is missing and saves nothing', async () => {
  const { onDone } = await renderScreen();
  await press('Go to fitting room');
  expect(screen.getByText(MISSING)).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();
});

test('170 cm and 65 kg go to onDone in metric', async () => {
  const { onDone } = await renderScreen();
  await type('Height', '170');
  await type('Weight', '65');
  await press('Go to fitting room');
  expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ heightCm: 170, weightKg: 65 }), 'metric');
  expect(screen.queryByText(MISSING)).toBeNull();
});

test("a height error shows after the field loses focus, and hides once it's fixed", async () => {
  await renderScreen();
  const message = fieldErrors({ ...EMPTY_FORM, heightCm: '300' }).height!;
  await type('Height', '300');
  expect(screen.queryByText(message)).toBeNull();
  await fireEvent(screen.getByLabelText('Height'), 'blur');
  expect(screen.getByText(message)).toBeTruthy();
  await type('Height', '170');
  expect(screen.queryByText(message)).toBeNull();
});

test('switching to ft, lb converts what was typed', async () => {
  await renderScreen();
  await type('Height', '170');
  await type('Weight', '65');
  await fireEvent.press(screen.getByText('ft, lb'));
  const expected = switchUnits({ ...EMPTY_FORM, heightCm: '170', weight: '65' }, 'imperial');
  expect(screen.getByLabelText('Feet').props.value).toBe(expected.heightFt);
  expect(screen.getByLabelText('Inches').props.value).toBe(expected.heightIn);
  expect(screen.getByLabelText('Weight').props.value).toBe(expected.weight);
});

test("women's clothes: the tape section asks for the full bust and a bra size", async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('Women’s clothes'));
  await press('Have a tape measure? Add your own numbers');
  expect(screen.getByText('Full bust')).toBeTruthy();
  expect(screen.getByLabelText('Bra size')).toBeTruthy();
});

test("men's clothes: chest, and no bra size", async () => {
  await renderScreen();
  await press('Have a tape measure? Add your own numbers');
  expect(screen.getByText('Chest')).toBeTruthy();
  expect(screen.queryByLabelText('Bra size')).toBeNull();
});

test('a valid body shows the estimates beside the mannequin', async () => {
  await renderScreen();
  expect(screen.getByText('Enter your height and weight to size it to you.')).toBeTruthy();
  await type('Height', '170');
  await type('Weight', '65');
  expect(screen.getByText('Waist')).toBeTruthy();
  expect(screen.getAllByText('estimate').length).toBe(4);
});

test('the mannequin preview: a typical body until height and weight are valid, then yours', async () => {
  await renderScreen();
  const typical = screen.getByLabelText('Mannequin preview, a typical body until you enter yours');
  expect(within(typical).getByLabelText(/^Mannequin, 176 cm tall/)).toBeTruthy();
  expect(screen.queryByLabelText('Mannequin preview of your body')).toBeNull();
  await type('Height', '170');
  expect(screen.getByLabelText('Mannequin preview, a typical body until you enter yours')).toBeTruthy();
  await type('Weight', '65');
  const yours = screen.getByLabelText('Mannequin preview of your body');
  expect(within(yours).getByLabelText(/^Mannequin, 170 cm tall/)).toBeTruthy();
});

test('Cancel calls onCancel, not onDone', async () => {
  const onCancel = jest.fn();
  const { onDone } = await renderScreen({
    initial: { heightCm: 175, weightKg: 70, bodyType: 'mens' },
    onCancel,
  });
  await press('Cancel');
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onDone).not.toHaveBeenCalled();
});

test('no Test mode switch without testMode', async () => {
  await renderScreen();
  expect(screen.queryByRole('switch')).toBeNull();
});

test('the Test mode switch, in development, reports changes', async () => {
  const onChange = jest.fn();
  await renderScreen({ testMode: { on: false, onChange } });
  await fireEvent(screen.getByRole('switch'), 'valueChange', true);
  expect(onChange).toHaveBeenCalledWith(true);
});

test('taps reach buttons while the keyboard is up', async () => {
  await renderScreen();
  expect(screen.getByTestId('body-scroll').props.keyboardShouldPersistTaps).toBe('handled');
});
