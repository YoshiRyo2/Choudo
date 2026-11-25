import Storage from 'expo-sqlite/kv-store';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { findGarment } from '@choudo/core/domain/garments';
import { EMPTY_OUTFIT, STORAGE_KEYS, type SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { forgetThisLaunch } from '@/hooks/use-persistent-state';

jest.mock('react-native-view-shot', () => ({ __esModule: true, captureRef: jest.fn(async () => 'file:///tmp/outfit.png') }));
jest.mock('expo-sharing', () => ({ __esModule: true, isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
const { captureRef } = jest.requireMock('react-native-view-shot') as { captureRef: jest.Mock };
const Sharing = jest.requireMock('expo-sharing') as { isAvailableAsync: jest.Mock; shareAsync: jest.Mock };

const appDir = './src/app';
const BODY = { heightCm: 183, weightKg: 79, bodyType: 'mens' } as const;
const hoodie = findGarment('gildan-18500')!;
const chino = findGarment('fieldline-slim-chino')!;
const jacket = findGarment('port-authority-j317')!;
const outfit: SavedOutfit = {
  ...EMPTY_OUTFIT,
  topId: hoodie.id,
  topSize: 'L',
  bottomId: chino.id,
  bottomSize: '32',
  outerId: jacket.id,
  outerSize: 'XL',
  id: 'o1',
  name: 'Weekend',
  savedAt: '2026-11-01T00:00:00.000Z',
};

beforeEach(() => {
  Storage.clearSync();
  forgetThisLaunch();
  jest.clearAllMocks();
  Sharing.isAvailableAsync.mockResolvedValue(true);
  Sharing.shareAsync.mockResolvedValue(undefined);
  Storage.setItemSync(STORAGE_KEYS.body, JSON.stringify(BODY));
  Storage.setItemSync(STORAGE_KEYS.outfits, JSON.stringify([outfit]));
});

async function openShare(id = 'o1') {
  await renderRouter(appDir, { initialUrl: '/' });
  await act(() => router.push(`/share-outfit?id=${id}`));
}

type Node = { props?: { testID?: string }; children?: (Node | string)[] | null };

/** Every piece of text drawn inside the share card (what the image shows). */
function cardWords(): string[] {
  const find = (n: Node | string | null | undefined): Node | null => {
    if (!n || typeof n === 'string') return null;
    if (n.props?.testID === 'share-card') return n;
    for (const c of n.children ?? []) {
      const hit = find(c);
      if (hit) return hit;
    }
    return null;
  };
  const card = find(screen.toJSON() as unknown as Node);
  expect(card).not.toBeNull();
  const out: string[] = [];
  const walk = (n: Node | string): void => {
    if (typeof n === 'string') return void out.push(n);
    (n.children ?? []).forEach(walk);
  };
  walk(card!);
  return out;
}

test('the card shows the outfit’s name and a line per garment, top to jacket', async () => {
  await openShare();
  expect(screen.getByText('Share outfit')).toBeTruthy();
  expect(screen.getByText('Weekend')).toBeTruthy();
  for (const [g, size] of [
    [hoodie, 'L'],
    [chino, '32'],
    [jacket, 'XL'],
  ] as const) {
    expect(screen.getByText(`${g.brand} ${g.name} · ${size}`)).toBeTruthy();
  }
});

test('nothing about the body in words: no measurements, no body type, no height', async () => {
  await openShare();
  const words = cardWords().join(' \n ');
  expect(words).toContain('Weekend');
  expect(words).not.toMatch(/\d\s?(cm|kg|lb|in)\b/);
  expect(words).not.toMatch(/Women’s|Men’s/);
  expect(words).not.toContain('183');
});

test('Share captures the card at 1080 × 1350 and opens the share sheet with it', async () => {
  await openShare();
  await act(() => fireEvent.press(screen.getByRole('button', { name: 'Share' })));
  expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png', quality: 1, width: 1080, height: 1350 }));
  expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/outfit.png', { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Weekend' });
});

test('a cancelled share shows nothing', async () => {
  Sharing.shareAsync.mockRejectedValue(new Error('User did not share'));
  await openShare();
  await act(() => fireEvent.press(screen.getByRole('button', { name: 'Share' })));
  expect(Sharing.shareAsync).toHaveBeenCalled();
  expect(screen.queryByText(/error|wrong|couldn/i)).toBeNull();
  expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
});

test('where sharing isn’t available, it says so in place of the button', async () => {
  Sharing.isAvailableAsync.mockResolvedValue(false);
  await openShare();
  expect(screen.getByText('Sharing isn’t available here.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
});

test('an outfit that is gone closes the sheet', async () => {
  await openShare('outfit-that-is-gone');
  expect(screen).toHavePathname('/');
});
