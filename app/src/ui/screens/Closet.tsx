import { useMemo, useState } from 'react';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { AboutSheet } from '../components/AboutSheet';
import { FitSheet } from '../components/FitSheet';
import { SegmentedControl } from '../components/SegmentedControl';
import { resolveOutfit, suggestedFit } from '@choudo/core/ui-logic/state/outfit';
import { foldersContaining } from '@choudo/core/ui-logic/state/closet';
import type { FolderItem, Outfit, UnitSystem } from '@choudo/core/ui-logic/state/stored';
import type { Closet as ClosetState } from '../state/useCloset';
import { FolderPicker } from './closet/FolderPicker';
import { FoldersTab } from './closet/FoldersTab';
import { LikedTab } from './closet/LikedTab';
import { OutfitsTab } from './closet/OutfitsTab';
import './Closet.css';

type ClosetTab = 'liked' | 'folders' | 'outfits';

/** The item whose folders are being edited, and what to call it. */
interface Filing {
  item: FolderItem;
  title: string;
}

interface ClosetProps {
  body: BodyInput;
  preference: PreferenceSpec;
  units: UnitSystem;
  /** Every garment the app may show (`publicGarments`): likes, folders and outfits that point elsewhere are skipped. */
  garments: readonly Garment[];
  /** Test mode: the fit sheet shows each zone's chances. */
  showOdds?: boolean;
  closet: ClosetState;
  /** The fitting room's outfit, as stored. */
  outfit: Outfit;
  onTryOn: (garment: Garment, size: string) => void;
  onWear: (outfit: Outfit) => void;
  onEditBody: () => void;
  onOpenDiscover: () => void;
}

/** Liked garments, folders of them, and saved outfits. */
export function Closet({
  body,
  preference,
  units,
  garments,
  showOdds,
  closet,
  outfit,
  onTryOn,
  onWear,
  onEditBody,
  onOpenDiscover,
}: ClosetProps) {
  const model = useMemo(() => estimateBody(body), [body]);
  const current = useMemo(() => resolveOutfit(outfit, model, preference, garments, garments), [outfit, model, preference, garments]);
  const [tab, setTab] = useState<ClosetTab>('liked');
  const [details, setDetails] = useState<Garment | null>(null);
  const [filing, setFiling] = useState<Filing | null>(null);
  const [about, setAbout] = useState(false);
  const folderCount = (kind: FolderItem['kind']) => (id: string) =>
    foldersContaining(closet.folders, { kind, id }).length;

  return (
    <main className="closet">
      <header className="screen-head">
        <h1>Closet</h1>
        <button type="button" className="button button--quiet screen-head__action" onClick={() => setAbout(true)}>
          About
        </button>
      </header>
      {about && <AboutSheet onClose={() => setAbout(false)} />}
      <div className="closet__tabs">
        <SegmentedControl
          label="Closet section"
          hideLabel
          value={tab}
          options={[
            { value: 'liked', label: 'Liked' },
            { value: 'folders', label: 'Folders' },
            { value: 'outfits', label: 'Outfits' },
          ]}
          onChange={setTab}
        />
      </div>

      {tab === 'liked' && (
        <LikedTab
          model={model}
          preference={preference}
          garments={garments}
          likedIds={closet.liked}
          onOpen={setDetails}
          onUnlike={closet.unlike}
          folderCount={folderCount('garment')}
          onFolders={(g) => setFiling({ item: { kind: 'garment', id: g.id }, title: g.name })}
          onOpenDiscover={onOpenDiscover}
        />
      )}
      {tab === 'outfits' && (
        <OutfitsTab
          model={model}
          garments={garments}
          outfits={closet.outfits}
          current={current}
          onSave={(name) => closet.saveOutfit(current, name)}
          onWear={onWear}
          onDelete={closet.deleteOutfit}
          folderCount={folderCount('outfit')}
          onFolders={(o) => setFiling({ item: { kind: 'outfit', id: o.id }, title: o.name })}
        />
      )}
      {tab === 'folders' && (
        <FoldersTab
          model={model}
          garments={garments}
          folders={closet.folders}
          outfits={closet.outfits}
          onCreate={closet.createFolder}
          onRename={closet.renameFolder}
          onDelete={closet.deleteFolder}
          onRemove={closet.removeFromFolder}
          onOpenGarment={setDetails}
          onWear={onWear}
        />
      )}

      {filing && (
        <FolderPicker
          title={filing.title}
          item={filing.item}
          folders={closet.folders}
          onToggle={(folderId) => closet.toggleInFolder(folderId, filing.item)}
          onCreate={(name) => closet.createFolderWith(name, filing.item)}
          onClose={() => setFiling(null)}
        />
      )}

      {details && (
        <FitSheet
          garment={details}
          model={model}
          preference={preference}
          size={suggestedFit(model, details, preference).fit.sizeLabel}
          units={units}
          onClose={() => setDetails(null)}
          onTryOn={(size) => onTryOn(details, size)}
          onEditBody={onEditBody}
          showOdds={showOdds}
        />
      )}
    </main>
  );
}
