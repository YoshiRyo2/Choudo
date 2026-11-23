import { NameForm } from '../../components/NameForm';
import { Sheet } from '../../components/Sheet';
import { isInFolder } from '../../state/closet';
import type { Folder, FolderItem } from '../../state/stored';

interface FolderPickerProps {
  /** What's being filed, e.g. "Slim Chino". */
  title: string;
  item: FolderItem;
  folders: Folder[];
  onToggle: (folderId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

/** Tick the folders an item belongs in, or make a new one for it. */
export function FolderPicker({ title, item, folders, onToggle, onCreate, onClose }: FolderPickerProps) {
  return (
    <Sheet title={title} kicker="Folders" onClose={onClose}>
      {folders.length > 0 ? (
        <ul className="folder-picker">
          {folders.map((f) => (
            <li key={f.id}>
              <label className="folder-picker__row">
                <input type="checkbox" checked={isInFolder(f, item)} onChange={() => onToggle(f.id)} />
                <span>{f.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="closet__note">No folders yet. Name one to put this in it.</p>
      )}
      <NameForm label="New folder" submitLabel="Create" placeholder="e.g. Work, Summer" onSubmit={onCreate} />
    </Sheet>
  );
}

/** "Folders" on a tile, with how many it's in. */
export function FoldersButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" className="button button--quiet button--small" onClick={onClick}>
      {count > 0 ? `In ${count} folder${count === 1 ? '' : 's'}` : 'Add to folder'}
    </button>
  );
}
