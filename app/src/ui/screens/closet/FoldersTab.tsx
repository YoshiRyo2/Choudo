import { useState } from 'react';
import type { BodyModel } from '../../../domain/body';
import { findGarment, type Garment } from '../../../domain/garments';
import { ConfirmButton } from '../../components/ConfirmButton';
import { GarmentIcon } from '../../components/GarmentIcon';
import { NameForm } from '../../components/NameForm';
import { folderSummary, outfitOf } from '../../state/closet';
import type { Folder, FolderItem, Outfit, SavedOutfit } from '../../state/stored';
import { OutfitFigure, outfitLine } from './OutfitCard';

interface FoldersTabProps {
  model: BodyModel;
  folders: Folder[];
  outfits: SavedOutfit[];
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onRemove: (folderId: string, item: FolderItem) => void;
  onOpenGarment: (garment: Garment) => void;
  onWear: (outfit: Outfit) => void;
}

/** Named folders of liked garments and saved outfits. */
export function FoldersTab(props: FoldersTabProps) {
  const { folders, onCreate } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const open = folders.find((f) => f.id === openId);

  if (open) return <FolderView {...props} folder={open} onBack={() => setOpenId(null)} />;

  return (
    <section className="closet__section" aria-label="Folders">
      <div className="closet__card">
        <NameForm label="New folder" submitLabel="Create" placeholder="e.g. Work, Summer" onSubmit={onCreate} />
      </div>
      {folders.length === 0 ? (
        <p className="closet__note">
          No folders yet. Make one here, then use “Add to folder” on a liked garment or a saved outfit.
        </p>
      ) : (
        <ul className="folder-list">
          {folders.map((f) => (
            <li key={f.id}>
              <button type="button" className="folder-list__row" onClick={() => setOpenId(f.id)}>
                <span className="folder-list__name">{f.name}</span>
                <span className="folder-list__count">{folderSummary(f)}</span>
                <span className="folder-list__chevron" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FolderView({
  model,
  folder,
  outfits,
  onRename,
  onDelete,
  onRemove,
  onOpenGarment,
  onWear,
  onBack,
}: FoldersTabProps & { folder: Folder; onBack: () => void }) {
  const [renaming, setRenaming] = useState(false);

  return (
    <section className="closet__section" aria-label={`Folder ${folder.name}`}>
      <button type="button" className="button button--quiet button--small folder-view__back" onClick={onBack}>
        ← All folders
      </button>

      {renaming ? (
        <NameForm
          label="Folder name"
          submitLabel="Rename"
          initial={folder.name}
          autoFocus
          onSubmit={(name) => {
            onRename(folder.id, name);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <div className="folder-view__head">
          <h2 className="folder-view__name">{folder.name}</h2>
          <button type="button" className="button button--quiet button--small" onClick={() => setRenaming(true)}>
            Rename
          </button>
          <ConfirmButton
            label="Delete"
            confirmLabel="Delete folder?"
            onConfirm={() => {
              onDelete(folder.id);
              onBack();
            }}
          />
        </div>
      )}

      {folder.items.length === 0 ? (
        <p className="closet__note">Nothing here yet. Use “Add to folder” on a liked garment or a saved outfit.</p>
      ) : (
        <ul className="tile-grid">
          {folder.items.map((item) => {
            const remove = (
              <button type="button" className="button button--quiet button--small" onClick={() => onRemove(folder.id, item)}>
                Remove
              </button>
            );
            if (item.kind === 'garment') {
              const g = findGarment(item.id);
              if (!g) return null;
              return (
                <li key={`g-${g.id}`} className="tile">
                  <button type="button" className="tile__main" onClick={() => onOpenGarment(g)}>
                    <GarmentIcon garment={g} />
                    <span className="tile__brand">{g.brand}</span>
                    <span className="tile__name">{g.name}</span>
                  </button>
                  <div className="tile__actions">{remove}</div>
                </li>
              );
            }
            const o = outfits.find((x) => x.id === item.id);
            if (!o) return null;
            return (
              <li key={`o-${o.id}`} className="tile outfit-tile">
                <OutfitFigure body={model.measurements} outfit={o} />
                <h3 className="tile__name">{o.name}</h3>
                <p className="tile__brand">{outfitLine(o)}</p>
                <div className="tile__actions">
                  <button type="button" className="button button--primary button--small" onClick={() => onWear(outfitOf(o))}>
                    Open
                  </button>
                  {remove}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
