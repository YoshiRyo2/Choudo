/**
 * Folder and saved-outfit operations for the Closet. Pure: every function takes
 * the current list and returns a new one. Ids and timestamps are passed in so
 * the functions stay testable.
 */

import { findGarment, type Garment } from '../../domain/garments';
import type { Folder, FolderItem, Outfit, SavedOutfit } from './stored';

export const MAX_NAME_LENGTH = 40;

/** Trim and squash whitespace; null when nothing is left. */
export function cleanName(name: string): string | null {
  const cleaned = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/** A short random id. (crypto.randomUUID isn't available over plain-http LAN.) */
export function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const sameItem = (a: FolderItem, b: FolderItem) => a.kind === b.kind && a.id === b.id;

// ---------- folders ----------

/** Add a folder at the end. A blank name does nothing. */
export function createFolder(folders: Folder[], id: string, name: string): Folder[] {
  const clean = cleanName(name);
  if (!clean) return folders;
  return [...folders, { id, name: clean, items: [] }];
}

/** Rename a folder. A blank name does nothing. */
export function renameFolder(folders: Folder[], id: string, name: string): Folder[] {
  const clean = cleanName(name);
  if (!clean) return folders;
  return folders.map((f) => (f.id === id ? { ...f, name: clean } : f));
}

export function deleteFolder(folders: Folder[], id: string): Folder[] {
  return folders.filter((f) => f.id !== id);
}

export function isInFolder(folder: Folder, item: FolderItem): boolean {
  return folder.items.some((i) => sameItem(i, item));
}

/** Add to a folder (newest first). Adding something already there does nothing. */
export function addToFolder(folders: Folder[], folderId: string, item: FolderItem): Folder[] {
  return folders.map((f) => (f.id === folderId && !isInFolder(f, item) ? { ...f, items: [item, ...f.items] } : f));
}

export function removeFromFolder(folders: Folder[], folderId: string, item: FolderItem): Folder[] {
  return folders.map((f) => (f.id === folderId ? { ...f, items: f.items.filter((i) => !sameItem(i, item)) } : f));
}

export function toggleInFolder(folders: Folder[], folderId: string, item: FolderItem): Folder[] {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return folders;
  return isInFolder(folder, item) ? removeFromFolder(folders, folderId, item) : addToFolder(folders, folderId, item);
}

/** Take an item out of every folder — used when a garment is unliked or an outfit deleted. */
export function removeEverywhere(folders: Folder[], item: FolderItem): Folder[] {
  return folders.map((f) => (isInFolder(f, item) ? { ...f, items: f.items.filter((i) => !sameItem(i, item)) } : f));
}

export function foldersContaining(folders: Folder[], item: FolderItem): Folder[] {
  return folders.filter((f) => isInFolder(f, item));
}

/** "2 garments, 1 outfit", or "Empty". */
export function folderSummary(folder: Folder): string {
  const count = (kind: FolderItem['kind']) => folder.items.filter((i) => i.kind === kind).length;
  const part = (n: number, word: string) => (n === 0 ? null : `${n} ${word}${n === 1 ? '' : 's'}`);
  const parts = [part(count('garment'), 'garment'), part(count('outfit'), 'outfit')].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Empty';
}

// ---------- outfits ----------

/** "Outfit 1", "Outfit 2", … — the first number not already used. */
export function nextOutfitName(outfits: SavedOutfit[]): string {
  const taken = new Set(outfits.map((o) => o.name));
  let n = outfits.length + 1;
  for (let i = 1; i <= n; i++) {
    if (!taken.has(`Outfit ${i}`)) {
      n = i;
      break;
    }
  }
  return `Outfit ${n}`;
}

/** Save an outfit at the front of the list. A blank name falls back to the next "Outfit N". */
export function saveOutfit(outfits: SavedOutfit[], outfit: Outfit, id: string, name: string, at: string): SavedOutfit[] {
  const { topId, topSize, bottomId, bottomSize, outerId, outerSize, onepieceId, onepieceSize } = outfit;
  const saved: SavedOutfit = {
    id,
    name: cleanName(name) ?? nextOutfitName(outfits),
    savedAt: at,
    topId,
    topSize,
    bottomId,
    bottomSize,
    outerId,
    outerSize,
    onepieceId,
    onepieceSize,
  };
  return [saved, ...outfits];
}

export function deleteOutfit(outfits: SavedOutfit[], id: string): SavedOutfit[] {
  return outfits.filter((o) => o.id !== id);
}

/** The plain outfit part, for loading into the fitting room. */
export function outfitOf(saved: SavedOutfit): Outfit {
  const { topId, topSize, bottomId, bottomSize, outerId, outerSize, onepieceId, onepieceSize } = saved;
  return { topId, topSize, bottomId, bottomSize, outerId, outerSize, onepieceId, onepieceSize };
}

// ---------- what the current catalogue hides ----------

/**
 * True for a garment that exists but isn't in `available` (the garments the app may
 * show, `publicGarments`): a sample on the public site. An id we don't know at all is
 * "gone", not hidden, and keeps its old handling.
 */
export function isHiddenGarment(id: string, available: readonly Pick<Garment, 'id'>[]): boolean {
  return findGarment(id) !== undefined && !available.some((g) => g.id === id);
}

/** An outfit's garment ids, top, bottom, dress, jacket (empty slots left out). */
function outfitIds(outfit: Outfit): string[] {
  return [outfit.topId, outfit.bottomId, outfit.onepieceId, outfit.outerId].filter((id): id is string => id !== null);
}

/**
 * Whether a saved outfit is shown: not when it wears a hidden garment (it would show
 * as something it isn't). Nothing stored changes; it shows again where samples do.
 */
export function showsOutfit(outfit: Outfit, available: readonly Pick<Garment, 'id'>[]): boolean {
  return outfitIds(outfit).every((id) => !isHiddenGarment(id, available));
}

/** The liked garments to show, in stored order: hidden ones and ones that are gone are skipped. */
export function shownLikes(likedIds: readonly string[], available: readonly Garment[]): Garment[] {
  return likedIds.flatMap((id) => available.find((g) => g.id === id) ?? []);
}

/** A folder's items that can be shown: hidden garments, and saved outfits that wear one, are skipped (stored as they are). */
export function shownFolderItems(folder: Folder, outfits: readonly SavedOutfit[], available: readonly Pick<Garment, 'id'>[]): FolderItem[] {
  return folder.items.filter((item) => {
    if (item.kind === 'garment') return !isHiddenGarment(item.id, available);
    const outfit = outfits.find((o) => o.id === item.id);
    return !outfit || showsOutfit(outfit, available);
  });
}
