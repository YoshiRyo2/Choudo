import { useLocalSearchParams } from 'expo-router';
import type { FolderItem } from '@choudo/core/ui-logic/state/stored';

import { useCloset } from '@/hooks/use-closet';
import { useLeaveIf } from '@/hooks/use-leave-if';
import { FolderPicker } from '@/screens/folder-picker';

/**
 * The folder picker, a form sheet: `?kind=garment|outfit&id=&title=`. Closes itself when the
 * item is no longer liked (or saved), e.g. unliked while the sheet was open.
 */
export default function FolderPickerRoute() {
  const params = useLocalSearchParams<{ kind?: string; id?: string; title?: string }>();
  const closet = useCloset();
  const kind: FolderItem['kind'] = params.kind === 'outfit' ? 'outfit' : 'garment';
  const id = params.id ?? '';
  const exists = kind === 'garment' ? closet.liked.includes(id) : closet.outfits.some((o) => o.id === id);
  const leave = useLeaveIf(!exists);
  if (leave !== undefined) return leave;
  const item: FolderItem = { kind, id };
  return (
    <FolderPicker
      title={params.title ?? ''}
      item={item}
      folders={closet.folders}
      onToggle={(folderId) => closet.toggleInFolder(folderId, item)}
      onCreate={(name) => closet.createFolderWith(name, item)}
    />
  );
}
