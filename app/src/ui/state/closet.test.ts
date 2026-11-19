import { describe, expect, it } from 'vitest';
import {
  addToFolder,
  cleanName,
  createFolder,
  deleteFolder,
  deleteOutfit,
  foldersContaining,
  nextOutfitName,
  outfitOf,
  removeEverywhere,
  removeFromFolder,
  renameFolder,
  saveOutfit,
  toggleInFolder,
} from './closet';
import type { Folder, SavedOutfit } from './stored';

const tee = { kind: 'garment', id: 'tee' } as const;
const jeans = { kind: 'garment', id: 'jeans' } as const;
const look = { kind: 'outfit', id: 'tee' } as const; // same id, different kind

const twoFolders = (): Folder[] => createFolder(createFolder([], 'f1', 'Work'), 'f2', 'Weekend');

describe('cleanName', () => {
  it('trims, squashes spaces and rejects blanks', () => {
    expect(cleanName('  Date   night ')).toBe('Date night');
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('x'.repeat(60))).toHaveLength(40);
  });
});

describe('folders', () => {
  it('creates, renames and deletes', () => {
    const folders = twoFolders();
    expect(folders.map((f) => f.name)).toEqual(['Work', 'Weekend']);
    expect(renameFolder(folders, 'f1', ' Office ').map((f) => f.name)).toEqual(['Office', 'Weekend']);
    expect(deleteFolder(folders, 'f1').map((f) => f.id)).toEqual(['f2']);
  });

  it('ignores blank names', () => {
    const folders = twoFolders();
    expect(createFolder(folders, 'f3', '  ')).toBe(folders);
    expect(renameFolder(folders, 'f1', '')).toBe(folders);
  });

  it('adds items newest first, never twice', () => {
    let folders = addToFolder(twoFolders(), 'f1', tee);
    folders = addToFolder(folders, 'f1', jeans);
    folders = addToFolder(folders, 'f1', tee);
    expect(folders[0]!.items).toEqual([jeans, tee]);
  });

  it('tells garments and outfits apart even with the same id', () => {
    const folders = addToFolder(addToFolder(twoFolders(), 'f1', tee), 'f1', look);
    expect(folders[0]!.items).toEqual([look, tee]);
    expect(removeFromFolder(folders, 'f1', tee)[0]!.items).toEqual([look]);
  });

  it('lets one item sit in several folders', () => {
    const folders = addToFolder(addToFolder(twoFolders(), 'f1', tee), 'f2', tee);
    expect(foldersContaining(folders, tee).map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(foldersContaining(removeEverywhere(folders, tee), tee)).toEqual([]);
  });

  it('toggles membership', () => {
    const on = toggleInFolder(twoFolders(), 'f2', tee);
    expect(on[1]!.items).toEqual([tee]);
    expect(toggleInFolder(on, 'f2', tee)[1]!.items).toEqual([]);
    expect(toggleInFolder(on, 'missing', tee)).toBe(on);
  });
});

describe('outfits', () => {
  const current = { topId: 'tee', topSize: 'M', bottomId: 'jeans', bottomSize: '32x32' };

  it('saves the current outfit at the front with its sizes', () => {
    const outfits = saveOutfit([], current, 'o1', 'Friday', '2026-11-18T10:00:00Z');
    const more = saveOutfit(outfits, { ...current, topSize: 'L' }, 'o2', 'Saturday', '2026-11-18T11:00:00Z');
    expect(more.map((o) => o.name)).toEqual(['Saturday', 'Friday']);
    expect(outfitOf(more[1]!)).toEqual(current);
  });

  it('names blank outfits "Outfit N", skipping names in use', () => {
    const named = (...names: string[]) => names.map((name, i) => ({ ...current, id: `${i}`, name, savedAt: '' }) as SavedOutfit);
    expect(nextOutfitName([])).toBe('Outfit 1');
    expect(nextOutfitName(named('Outfit 1', 'Outfit 3'))).toBe('Outfit 2');
    expect(nextOutfitName(named('Outfit 1', 'Outfit 2'))).toBe('Outfit 3');
    expect(saveOutfit(named('Outfit 1'), current, 'o9', '  ', '')[0]!.name).toBe('Outfit 2');
  });

  it('deletes by id', () => {
    const outfits = saveOutfit(saveOutfit([], current, 'o1', 'A', ''), current, 'o2', 'B', '');
    expect(deleteOutfit(outfits, 'o1').map((o) => o.id)).toEqual(['o2']);
  });
});
