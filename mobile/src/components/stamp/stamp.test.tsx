import { act, render, screen } from '@testing-library/react-native';

import { Stamp } from './index';

afterEach(() => jest.useRealTimers());

test('the seal is named for VoiceOver', async () => {
  await render(<Stamp dropping={false} />);
  expect(screen.getByRole('image', { name: 'ちょうど: just right' })).toBeTruthy();
});

test('onLanded fires as the drop touches down (55 % of 260 ms), once', async () => {
  jest.useFakeTimers();
  const onLanded = jest.fn();
  await render(<Stamp dropping onLanded={onLanded} />);
  await act(() => jest.advanceTimersByTime(140));
  expect(onLanded).not.toHaveBeenCalled();
  await act(() => jest.advanceTimersByTime(10));
  expect(onLanded).toHaveBeenCalledTimes(1);
  await act(() => jest.advanceTimersByTime(1000));
  expect(onLanded).toHaveBeenCalledTimes(1);
});

test('a stamp already seen is simply there: no landing', async () => {
  jest.useFakeTimers();
  const onLanded = jest.fn();
  await render(<Stamp dropping={false} onLanded={onLanded} />);
  await act(() => jest.advanceTimersByTime(1000));
  expect(onLanded).not.toHaveBeenCalled();
});
