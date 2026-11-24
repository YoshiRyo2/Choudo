import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme';

import { FieldError } from './field-error';
import { NumberField } from './number-field';
import { Segmented } from './segmented';

const edgeOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).borderColor;

test('shows the label, hint and unit', async () => {
  await render(
    <NumberField label="Waist" hint="Where your trousers sit" unit="cm" value="" onChangeText={() => {}} showLabel />,
  );
  expect(screen.getByText('Waist')).toBeTruthy();
  expect(screen.getByText('Where your trousers sit')).toBeTruthy();
  // The unit is printed, not read: VoiceOver gets the label (as the web's aria-hidden unit).
  expect(screen.getByText('cm', { includeHiddenElements: true })).toBeTruthy();
});

test('without showLabel the label is still the accessible name', async () => {
  await render(<NumberField label="Height" unit="cm" value="" onChangeText={() => {}} />);
  expect(screen.queryByText('Height')).toBeNull();
  expect(screen.getByLabelText('Height')).toBeTruthy();
});

test('a decimal pad, and typed text goes to onChangeText', async () => {
  const onChangeText = jest.fn();
  await render(<NumberField label="Height" unit="cm" value="" onChangeText={onChangeText} />);
  const input = screen.getByLabelText('Height');
  expect(input.props.keyboardType).toBe('decimal-pad');
  await fireEvent.changeText(input, '170,5');
  expect(onChangeText).toHaveBeenCalledWith('170,5');
});

test('invalid: a red edge, and the error is read with the field', async () => {
  await render(
    <NumberField label="Height" unit="cm" value="300" onChangeText={() => {}} invalid error="Too tall." testID="h" />,
  );
  expect(edgeOf('h-box')).toBe(colors.fitBad);
  expect(screen.getByLabelText('Height').props.accessibilityHint).toBe('Too tall.');
});

test('valid: the field edge colour and no hint', async () => {
  await render(<NumberField label="Height" unit="cm" value="170" onChangeText={() => {}} error="Too tall." testID="h" />);
  expect(edgeOf('h-box')).toBe(colors.fieldEdge);
  expect(screen.getByLabelText('Height').props.accessibilityHint).toBeUndefined();
});

// Bold ink, as on the web: fit colours are for fit results only (colors.ts).
test('FieldError shows its message in bold ink, politely announced', async () => {
  await render(<FieldError message="Enter both numbers to continue." />);
  const text = screen.getByText('Enter both numbers to continue.');
  expect(text.props.accessibilityLiveRegion).toBe('polite');
  expect(StyleSheet.flatten(text.props.style)).toMatchObject({ color: colors.ink, fontFamily: 'MPLUSRounded1c_700Bold' });
});

test('FieldError without a message renders nothing', async () => {
  await render(<FieldError />);
  expect(screen.toJSON()).toBeNull();
});

test('Segmented shows its label and reports the chosen value', async () => {
  const onChange = jest.fn();
  await render(
    <Segmented
      label="Units"
      value="metric"
      options={[
        { value: 'metric', label: 'cm, kg' },
        { value: 'imperial', label: 'ft, lb' },
      ]}
      onChange={onChange}
    />,
  );
  expect(screen.getByText('Units')).toBeTruthy();
  await fireEvent.press(screen.getByText('ft, lb'));
  expect(onChange).toHaveBeenCalledWith('imperial');
});
