import { fireEvent, render, screen } from '@testing-library/react-native';
import { INPUT_LIMITS } from '@choudo/core/domain/body';

import { MannequinLab } from './mannequin-lab';

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

test('with an empty store it draws the typical women’s body', async () => {
  await render(<MannequinLab />);
  expect(screen.getByRole('header', { name: 'Mannequin lab' })).toBeTruthy();
  expect(screen.getByLabelText('Mannequin, 163 cm tall')).toBeTruthy();
});

test('the height steps by 5 cm and stops at the input limits', async () => {
  await render(<MannequinLab />);
  await press('Taller by 5 cm');
  expect(screen.getByLabelText('Mannequin, 168 cm tall')).toBeTruthy();
  for (let i = 0; i < 30; i++) await press('Taller by 5 cm');
  expect(screen.getByLabelText(`Mannequin, ${INPUT_LIMITS.heightCm.max} cm tall`)).toBeTruthy();
});

test('picking a top and a jacket draws them, with fit pins', async () => {
  await render(<MannequinLab />);
  await press('Gildan Heavy Cotton T-Shirt (5000)');
  expect(screen.getByLabelText(/^Mannequin, 163 cm tall wearing Gildan Heavy Cotton T-Shirt \(5000\) in /)).toBeTruthy();
  await press('Port Authority Core Soft Shell Jacket (J317)');
  expect(screen.getByLabelText(/with Port Authority Core Soft Shell Jacket \(J317\) in \S+ over it$/)).toBeTruthy();
  expect(screen.getAllByTestId(/^pin-outer-/).length).toBeGreaterThan(0);
});

test('a dress takes the place of the top and the bottom', async () => {
  await render(<MannequinLab />);
  await press('Gildan Heavy Cotton T-Shirt (5000)');
  await press("Lands' End Women's Pattern Knit Shirred Surplice Dress (Regular)");
  const label = screen.getByLabelText(/^Mannequin, 163 cm tall wearing Lands/);
  expect(label.props.accessibilityLabel).not.toContain('Gildan');
});
