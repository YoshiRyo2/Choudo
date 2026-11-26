import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { fitTestsCsv } from '@choudo/core/ui-logic/state/fitTests';
import { STORAGE_KEYS, type FitTestRecord } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

// Test mode's gate: development, or a preview build. Switched per test.
let mockDevTools = true;
jest.mock('@/utils/dev-tools', () => ({
  get DEV_TOOLS() {
    return mockDevTools;
  },
}));

// The CSV goes to a file in the cache, then the share sheet.
const written: { name: string; text: string }[] = [];
jest.mock('expo-file-system', () => ({
  __esModule: true,
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    constructor(dir: { uri: string }, name: string) {
      this.uri = `${dir.uri}${name}`;
    }
    write(text: string) {
      written.push({ name: this.uri, text });
    }
  },
}));
jest.mock('expo-sharing', () => ({ __esModule: true, isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
const Sharing = jest.requireMock('expo-sharing') as { shareAsync: jest.Mock };

const appDir = './src/app';
const records = (): FitTestRecord[] => JSON.parse(Storage.getItemSync(STORAGE_KEYS.fitTests) ?? '[]') as FitTestRecord[];

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  written.length = 0;
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify({ heightCm: 170, weightKg: 65, bodyType: 'mens' }));
  Storage.setItemSync(STORAGE_KEYS.testMode, 'true');
  Storage.setItemSync(STORAGE_KEYS.outfit, JSON.stringify({ topId: 'gildan-5000', topSize: 'M', bottomId: null, bottomSize: null, outerId: null, outerSize: null, onepieceId: null, onepieceSize: null }));
});

describe('a store build (production)', () => {
  beforeEach(() => {
    mockDevTools = false;
  });

  test('no Test mode switch on Edit body', async () => {
    await renderRouter(appDir, { initialUrl: '/body' });
    expect(screen.getByRole('button', { name: 'About Choudo' })).toBeTruthy();
    expect(screen.queryByText('For fit testers')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  test('no Test mode panel in the Fitting room, even with Test mode stored on', async () => {
    await renderRouter(appDir, { initialUrl: '/fitting-room' });
    expect(screen.getByRole('button', { name: 'Edit body' })).toBeTruthy();
    expect(screen.queryByText('Test mode')).toBeNull();
  });
});

describe('development or a preview build', () => {
  beforeEach(() => {
    mockDevTools = true;
  });

  test('the switch is on Edit body', async () => {
    await renderRouter(appDir, { initialUrl: '/body' });
    expect(screen.getByText('For fit testers')).toBeTruthy();
    expect(screen.getByRole('switch', { name: /^Test mode/ })).toBeTruthy();
  });

  test('the panel records a top’s chest and length; Export writes the web’s CSV and opens the share sheet', async () => {
    await renderRouter(appDir, { initialUrl: '/fitting-room' });
    await act(() => fireEvent.changeText(screen.getByLabelText('Tester'), 'T01'));
    await act(() => fireEvent.press(screen.getByRole('radio', { name: 'Chest: Too tight' })));
    await act(() => fireEvent.press(screen.getByRole('radio', { name: 'Length: Just right' })));
    await act(() => fireEvent.press(screen.getByRole('radio', { name: 'Which size would they keep?: None' })));
    await act(() => fireEvent.press(screen.getByRole('button', { name: 'Save result' })));
    const [saved] = records();
    expect(saved).toMatchObject({ tester: 'T01', garmentId: 'gildan-5000', size: 'M', chest: 'too-tight', length: 'just-right', keptSize: null, category: 'top' });

    await act(() => fireEvent.press(screen.getByRole('button', { name: 'Export CSV' })));
    expect(written).toHaveLength(1);
    expect(written[0]!.name).toMatch(/^file:\/\/\/cache\/choudo-fit-tests-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(written[0]!.text).toBe(fitTestsCsv(records()));
    expect(Sharing.shareAsync).toHaveBeenCalledWith(written[0]!.name, expect.objectContaining({ mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' }));
  });
});
