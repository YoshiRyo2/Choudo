import type { BodyModel } from '@choudo/core/domain/body';
import type { Garment } from '@choudo/core/domain/garments';
import { ConfirmButton } from '../../components/ConfirmButton';
import { NameForm } from '../../components/NameForm';
import { nextOutfitName, outfitOf, showsOutfit } from '@choudo/core/ui-logic/state/closet';
import type { Outfit, SavedOutfit } from '@choudo/core/ui-logic/state/stored';
import { FoldersButton } from './FolderPicker';
import { outfitLine } from '@choudo/core/ui-logic/closetText';
import { OutfitFigure } from './OutfitCard';

interface OutfitsTabProps {
  model: BodyModel;
  /** Every garment the app may show: an outfit that wears any other (a sample on the public site) is skipped. */
  garments: readonly Garment[];
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
export function OutfitsTab({ model, garments, outfits: stored, current, onSave, onWear, onDelete, folderCount, onFolders }: OutfitsTabProps) {
  const outfits = stored.filter((o) => showsOutfit(o, garments));
  return (
    <section className="closet__section" aria-label="Saved outfits">
      <div className="closet__card">
        <p className="closet__note">
          In the fitting room now: <strong>{outfitLine(current, garments)}</strong>
        </p>
        <NameForm label="Save it as" submitLabel="Save outfit" placeholder={nextOutfitName(stored)} allowBlank onSubmit={onSave} />
      </div>

      {outfits.length === 0 ? (
        <p className="closet__note">No saved outfits yet. Put something together in the fitting room, then save it here.</p>
      ) : (
        <ul className="tile-grid">
          {outfits.map((o) => (
            <li key={o.id} className="tile outfit-tile">
              <OutfitFigure body={model.measurements} outfit={o} garments={garments} />
              <h3 className="tile__name">{o.name}</h3>
              <p className="tile__brand">{outfitLine(o, garments)}</p>
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
