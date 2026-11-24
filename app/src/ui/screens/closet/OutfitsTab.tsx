import type { BodyModel } from '@choudo/core/domain/body';
import { ConfirmButton } from '../../components/ConfirmButton';
import { NameForm } from '../../components/NameForm';
import { nextOutfitName, outfitOf } from '../../state/closet';
import type { Outfit, SavedOutfit } from '../../state/stored';
import { FoldersButton } from './FolderPicker';
import { OutfitFigure, outfitLine } from './OutfitCard';

interface OutfitsTabProps {
  model: BodyModel;
  outfits: SavedOutfit[];
  /** What's on the mannequin in the fitting room right now. */
  current: Outfit;
  onSave: (name: string) => void;
  onWear: (outfit: Outfit) => void;
  onDelete: (id: string) => void;
  folderCount: (outfitId: string) => number;
  onFolders: (outfit: SavedOutfit) => void;
}

/** Named top + bottom combinations saved from the fitting room. */
export function OutfitsTab({ model, outfits, current, onSave, onWear, onDelete, folderCount, onFolders }: OutfitsTabProps) {
  return (
    <section className="closet__section" aria-label="Saved outfits">
      <div className="closet__card">
        <p className="closet__note">
          In the fitting room now: <strong>{outfitLine(current)}</strong>
        </p>
        <NameForm label="Save it as" submitLabel="Save outfit" placeholder={nextOutfitName(outfits)} allowBlank onSubmit={onSave} />
      </div>

      {outfits.length === 0 ? (
        <p className="closet__note">No saved outfits yet. Put something together in the fitting room, then save it here.</p>
      ) : (
        <ul className="tile-grid">
          {outfits.map((o) => (
            <li key={o.id} className="tile outfit-tile">
              <OutfitFigure body={model.measurements} outfit={o} />
              <h3 className="tile__name">{o.name}</h3>
              <p className="tile__brand">{outfitLine(o)}</p>
              <div className="tile__actions">
                <button type="button" className="button button--primary button--small" onClick={() => onWear(outfitOf(o))}>
                  Open
                </button>
                <FoldersButton count={folderCount(o.id)} onClick={() => onFolders(o)} />
                <ConfirmButton label="Delete" confirmLabel="Sure?" onConfirm={() => onDelete(o.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
