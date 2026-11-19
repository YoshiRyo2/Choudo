import { useMemo } from 'react';
import {
  addToFolder,
  createFolder,
  deleteFolder,
  deleteOutfit,
  makeId,
  removeEverywhere,
  removeFromFolder,
  renameFolder,
  saveOutfit,
  toggleInFolder,
} from './closet';
import { likedIds, recordSwipe, unlike } from './feed';
import {
  isFolderList,
  isSavedOutfitList,
  isSwipeList,
  STORAGE_KEYS,
  type Folder,
  type FolderItem,
  type Outfit,
  type SavedOutfit,
  type Swipe,
} from './stored';
import { usePersistentState } from './usePersistentState';

const now = () => new Date().toISOString();

/**
 * Discover's swipes plus the Closet's folders and saved outfits, kept on the
 * device. A thin wrapper: the rules live in feed.ts and closet.ts.
 */
export function useCloset() {
  const [swipes, setSwipes] = usePersistentState<Swipe[]>(STORAGE_KEYS.swipes, [], isSwipeList);
  const [folders, setFolders] = usePersistentState<Folder[]>(STORAGE_KEYS.folders, [], isFolderList);
  const [outfits, setOutfits] = usePersistentState<SavedOutfit[]>(STORAGE_KEYS.outfits, [], isSavedOutfitList);
  const liked = useMemo(() => likedIds(swipes), [swipes]);

  return {
    swipes,
    folders,
    outfits,
    /** Liked garment ids, most recent first. */
    liked,
    swipe(garmentId: string, sizeShown: string, isLike: boolean) {
      setSwipes(recordSwipe(swipes, { garmentId, sizeShown, liked: isLike, at: now() }));
    },
    /** Unliking also takes the garment out of every folder. */
    unlike(garmentId: string) {
      setSwipes(unlike(swipes, garmentId, now()));
      setFolders(removeEverywhere(folders, { kind: 'garment', id: garmentId }));
    },
    createFolder(name: string): string {
      const id = makeId();
      setFolders(createFolder(folders, id, name));
      return id;
    },
    /** Make a folder and put an item straight into it. */
    createFolderWith(name: string, item: FolderItem) {
      const id = makeId();
      setFolders(addToFolder(createFolder(folders, id, name), id, item));
    },
    renameFolder(id: string, name: string) {
      setFolders(renameFolder(folders, id, name));
    },
    deleteFolder(id: string) {
      setFolders(deleteFolder(folders, id));
    },
    toggleInFolder(folderId: string, item: FolderItem) {
      setFolders(toggleInFolder(folders, folderId, item));
    },
    removeFromFolder(folderId: string, item: FolderItem) {
      setFolders(removeFromFolder(folders, folderId, item));
    },
    saveOutfit(outfit: Outfit, name: string) {
      setOutfits(saveOutfit(outfits, outfit, makeId(), name, now()));
    },
    /** Deleting an outfit also takes it out of every folder. */
    deleteOutfit(id: string) {
      setOutfits(deleteOutfit(outfits, id));
      setFolders(removeEverywhere(folders, { kind: 'outfit', id }));
    },
  };
}

export type Closet = ReturnType<typeof useCloset>;
