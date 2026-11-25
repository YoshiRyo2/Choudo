import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

jest.mock('expo-web-browser', () => ({ __esModule: true, openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })) }));
const WebBrowser = jest.requireMock('expo-web-browser') as { openBrowserAsync: jest.Mock };

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 170, weightKg: 65, bodyType: 'mens' }));
});

test('About has the privacy policy, opened in Safari', async () => {
  await renderRouter('./src/app', { initialUrl: '/about' });
  await act(() => fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' })));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://yoshiryo2.github.io/Choudo/privacy.html');
});
