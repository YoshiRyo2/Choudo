import { fireEvent, render, screen } from '@testing-library/react-native';
import { estimateBody } from '@choudo/core/domain/body';
import { fitGarment } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';

import { FitTestPanel } from '.';

const tee = findGarment('gildan-5000')!;
const fit = fitGarment(estimateBody({ heightCm: 170, weightKg: 65, bodyType: 'mens' }), tee, 'M');

async function show(records = 0) {
  const props = { onSave: jest.fn(), onClear: jest.fn(), onExport: jest.fn() };
  const list = Array.from({ length: records }, () => ({}) as never);
  await render(<FitTestPanel garment={tee} size="M" fit={fit} records={list} bodyType="mens" {...props} />);
  return props;
}

test('asks about the chest and the length of a top, and which size they would keep', async () => {
  const { onSave } = await show();
  expect(screen.getByText('Test mode')).toBeTruthy();
  expect(screen.getByText(`How does the ${tee.brand} ${tee.name} in M really fit?`)).toBeTruthy();
  const save = screen.getByRole('button', { name: 'Save result' });
  expect(save.props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.changeText(screen.getByLabelText('Tester'), 'T03');
  await fireEvent.press(screen.getByRole('radio', { name: 'Chest: Just right' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Length: Too long' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Which size would they keep?: L' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save result' }));
  expect(onSave).toHaveBeenCalledWith({ tester: 'T03', chest: 'just-right', length: 'too-long', keptSize: 'L' });
  expect(screen.getByText('Saved.')).toBeTruthy();
});

test('with results saved: how many, Export CSV and Clear (asked twice)', async () => {
  const { onExport, onClear } = await show(2);
  expect(screen.getByText('2 results saved on this device')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Export CSV' }));
  expect(onExport).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
  expect(onClear).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Tap again to clear all' }));
  expect(onClear).toHaveBeenCalled();
});
