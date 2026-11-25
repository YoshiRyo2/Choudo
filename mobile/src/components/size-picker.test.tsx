import { fireEvent, render, screen } from '@testing-library/react-native';
import { estimateBody } from '@choudo/core/domain/body';
import { fitAllSizes, preferenceSpec } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';
import { chipTone } from '@choudo/core/ui-logic/components/sizeRow';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';

import { SizePicker } from './size-picker';
import { toneColor } from './tone';

const model = estimateBody({ heightCm: 176, weightKg: 75, bodyType: 'mens' });
const tee = findGarment('gildan-5000')!;
const fits = fitAllSizes(model, tee);
const odds = garmentOdds(model, tee, preferenceSpec(null, null));

const TONE_NAME = { good: 'fits', warn: 'fits with a caveat', bad: 'likely won’t fit', unknown: 'fit unknown' } as const;

test('one radio per size, the selected one checked', async () => {
  await render(<SizePicker fits={fits} selected="L" recommended={odds.recommended} odds={odds} onSelect={() => {}} />);
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(tee.sizes.length);
  const checked = radios.filter((r) => r.props.accessibilityState?.selected);
  expect(checked).toHaveLength(1);
  expect(checked[0]!.props.accessibilityLabel.startsWith('L, ')).toBe(true);
});

test("each chip is named by its size and tone; the suggested one ends ', suggested size'", async () => {
  expect(odds.recommended).not.toBeNull();
  await render(<SizePicker fits={fits} selected="L" recommended={odds.recommended} odds={odds} onSelect={() => {}} />);
  for (const fit of fits) {
    const tone = chipTone(fit, odds);
    const suggested = fit.sizeLabel === odds.recommended ? ', suggested size' : '';
    expect(screen.getByLabelText(`${fit.sizeLabel}, ${TONE_NAME[tone]}${suggested}`)).toBeTruthy();
  }
  // The tag is decoration, hidden from VoiceOver: the chip's name already says it.
  expect(screen.queryByText('Suggested')).toBeNull();
  expect(screen.getAllByText('Suggested', { includeHiddenElements: true })).toHaveLength(1);
});

test('pressing a chip calls onSelect with its size', async () => {
  const onSelect = jest.fn();
  await render(<SizePicker fits={fits} selected="L" recommended={null} onSelect={onSelect} layout="row" />);
  await fireEvent.press(screen.getByLabelText(`M, ${TONE_NAME[chipTone(fits.find((f) => f.sizeLabel === 'M')!)]}`));
  expect(onSelect).toHaveBeenCalledWith('M');
});

test("each dot takes chipTone's colour", async () => {
  await render(<SizePicker fits={fits} selected="L" recommended={odds.recommended} odds={odds} onSelect={() => {}} />);
  for (const fit of fits) {
    const dot = screen.getByTestId(`size-dot-${fit.sizeLabel}`);
    const tone = chipTone(fit, odds);
    const style = Object.assign({}, ...[dot.props.style].flat(3).filter(Boolean));
    if (tone === 'unknown') expect(style.borderColor).toBe(toneColor.unknown);
    else expect(style.backgroundColor).toBe(toneColor[tone]);
  }
});
