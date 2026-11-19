import { useMemo, useState } from 'react';
import { estimateBody, type BodyInput } from '../../domain/body';
import type { Garment } from '../../domain/garments';
import { FitSheet } from '../components/FitSheet';
import { SegmentedControl } from '../components/SegmentedControl';
import { resolveOutfit, suggestedFit } from '../state/outfit';
import type { Outfit, UnitSystem } from '../state/stored';
import type { Closet as ClosetState } from '../state/useCloset';
import { LikedTab } from './closet/LikedTab';
import { OutfitsTab } from './closet/OutfitsTab';
import './Closet.css';

type ClosetTab = 'liked' | 'outfits';

interface ClosetProps {
  body: BodyInput;
  units: UnitSystem;
  closet: ClosetState;
  /** The fitting room's outfit, as stored. */
  outfit: Outfit;
  onTryOn: (garment: Garment, size: string) => void;
  onWear: (outfit: Outfit) => void;
  onEditBody: () => void;
  onOpenDiscover: () => void;
}

/** Liked garments and saved outfits. */
export function Closet({ body, units, closet, outfit, onTryOn, onWear, onEditBody, onOpenDiscover }: ClosetProps) {
  const model = useMemo(() => estimateBody(body), [body]);
  const current = useMemo(() => resolveOutfit(outfit, model), [outfit, model]);
  const [tab, setTab] = useState<ClosetTab>('liked');
  const [details, setDetails] = useState<Garment | null>(null);

  return (
    <main className="closet">
      <header className="screen-head">
        <h1>Closet</h1>
      </header>
      <div className="closet__tabs">
        <SegmentedControl
          label="Closet section"
          hideLabel
          value={tab}
          options={[
            { value: 'liked', label: 'Liked' },
            { value: 'outfits', label: 'Outfits' },
          ]}
          onChange={setTab}
        />
      </div>

      {tab === 'liked' && (
        <LikedTab
          model={model}
          likedIds={closet.liked}
          onOpen={setDetails}
          onUnlike={closet.unlike}
          onOpenDiscover={onOpenDiscover}
        />
      )}
      {tab === 'outfits' && (
        <OutfitsTab
          model={model}
          outfits={closet.outfits}
          current={current}
          onSave={(name) => closet.saveOutfit(current, name)}
          onWear={onWear}
          onDelete={closet.deleteOutfit}
        />
      )}

      {details && (
        <FitSheet
          garment={details}
          model={model}
          size={suggestedFit(model, details).fit.sizeLabel}
          units={units}
          onClose={() => setDetails(null)}
          onTryOn={(size) => onTryOn(details, size)}
          onEditBody={onEditBody}
        />
      )}
    </main>
  );
}
