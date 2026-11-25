// @vitest-environment jsdom
import './ui/test/dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_OUTFIT, STORAGE_KEYS, type Folder, type SavedOutfit, type Swipe } from '@choudo/core/ui-logic/state/stored';
import { App } from './App';

// The production build (GitHub Pages): no dev tools, so no sample garments.
vi.mock('./ui/devTools', () => ({ DEV_TOOLS: false, devToolsOn: () => false }));

const at = '2026-11-01T00:00:00.000Z';
const sampleOutfit: SavedOutfit = {
  ...EMPTY_OUTFIT,
  id: 'o-sample',
  name: 'Chino day',
  savedAt: at,
  topId: 'gildan-5000',
  topSize: 'L',
  bottomId: 'fieldline-slim-chino',
  bottomSize: '32',
};
const realOutfit: SavedOutfit = { ...EMPTY_OUTFIT, id: 'o-real', name: 'Hoodie day', savedAt: at, topId: 'gildan-18500', topSize: 'L' };
const swipes: Swipe[] = [
  { garmentId: 'fieldline-oxford', sizeShown: 'M', liked: true, at },
  { garmentId: 'gildan-5000', sizeShown: 'L', liked: true, at },
];
const folders: Folder[] = [
  {
    id: 'f1',
    name: 'Work',
    items: [
      { kind: 'garment', id: 'fieldline-oxford' },
      { kind: 'outfit', id: 'o-sample' },
      { kind: 'garment', id: 'gildan-5000' },
    ],
  },
];

const store = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

describe('the public site', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    store(STORAGE_KEYS.body, { heightCm: 176, weightKg: 80, bodyType: 'mens' });
    store(STORAGE_KEYS.outfit, { ...EMPTY_OUTFIT, topId: 'fieldline-boxy-tee', topSize: 'M', bottomId: 'corvo-slim-jean', bottomSize: '32' });
    store(STORAGE_KEYS.outfits, [sampleOutfit, realOutfit]);
    store(STORAGE_KEYS.swipes, swipes);
    store(STORAGE_KEYS.folders, folders);
  });

  const stored = () => ({
    outfit: localStorage.getItem(STORAGE_KEYS.outfit),
    outfits: localStorage.getItem(STORAGE_KEYS.outfits),
    swipes: localStorage.getItem(STORAGE_KEYS.swipes),
    folders: localStorage.getItem(STORAGE_KEYS.folders),
  });

  it('never shows a sample garment, and leaves what is stored alone', () => {
    const before = stored();
    render(<App />);
    expect(document.body.textContent).not.toMatch(/Fieldline|Corvo/);

    fireEvent.click(screen.getByRole('button', { name: /Discover/ }));
    expect(document.body.textContent).not.toMatch(/Fieldline|Corvo/);

    fireEvent.click(screen.getByRole('button', { name: /Closet/ }));
    expect(document.body.textContent).not.toMatch(/Fieldline|Corvo/);
    expect(stored()).toEqual(before);
  });

  it('skips a saved outfit with a Fieldline item, without a crash, and shows the others', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Closet/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Outfits' }));
    const outfits = screen.getByRole('region', { name: 'Saved outfits' });
    expect(within(outfits).queryByText('Chino day')).toBeNull();
    expect(within(outfits).getByText('Hoodie day')).toBeTruthy();
  });

  it('skips liked samples and hidden folder items, and counts only what it shows', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Closet/ }));
    expect(screen.getByRole('radio', { name: 'All 1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Folders' }));
    expect(screen.getByText('1 garment')).toBeTruthy();
  });
});
