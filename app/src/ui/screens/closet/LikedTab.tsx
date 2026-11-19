import { useState } from 'react';
import type { BodyModel } from '../../../domain/body';
import type { PreferenceSpec } from '../../../domain/fit';
import { findGarment, type Garment, type GarmentCategory } from '../../../domain/garments';
import { GarmentBadge } from '../../components/GarmentBadge';
import { GarmentIcon } from '../../components/GarmentIcon';
import { SegmentedControl } from '../../components/SegmentedControl';
import { sizeLine, verdictLine } from '../../fitText';
import { garmentOdds } from '../../state/odds';
import { suggestedFit } from '../../state/outfit';
import { FoldersButton } from './FolderPicker';

type Filter = 'all' | GarmentCategory;

interface LikedTabProps {
  model: BodyModel;
  preference: PreferenceSpec;
  likedIds: string[];
  onOpen: (garment: Garment) => void;
  onUnlike: (garmentId: string) => void;
  /** How many folders a garment is in. */
  folderCount: (garmentId: string) => number;
  onFolders: (garment: Garment) => void;
  onOpenDiscover: () => void;
}

/** Everything you've liked, newest first, filterable by tops and bottoms. */
export function LikedTab({ model, preference, likedIds, onOpen, onUnlike, folderCount, onFolders, onOpenDiscover }: LikedTabProps) {
  const [filter, setFilter] = useState<Filter>('all');
  // Likes for garments no longer in the catalogue are skipped.
  const liked = likedIds.map((id) => findGarment(id)).filter((g): g is Garment => g !== undefined);
  const shown = filter === 'all' ? liked : liked.filter((g) => g.category === filter);

  if (liked.length === 0) {
    return (
      <section className="empty-state">
        <h2>Nothing liked yet</h2>
        <p>Swipe right on a garment in Discover and it will be kept here.</p>
        <button type="button" className="button button--primary" onClick={onOpenDiscover}>
          Go to Discover
        </button>
      </section>
    );
  }

  return (
    <section className="closet__section" aria-label="Liked garments">
      <SegmentedControl
        label="Show"
        hideLabel
        value={filter}
        options={[
          { value: 'all', label: `All ${liked.length}` },
          { value: 'top', label: 'Tops' },
          { value: 'bottom', label: 'Bottoms' },
        ]}
        onChange={setFilter}
      />
      {shown.length === 0 ? (
        <p className="closet__note">No liked {filter === 'top' ? 'tops' : 'bottoms'} yet.</p>
      ) : (
        <ul className="tile-grid">
          {shown.map((g) => {
            const { fit, recommended } = suggestedFit(model, g, preference);
            const verdict = verdictLine(garmentOdds(model, g, preference), fit.sizeLabel, g);
            return (
              <li key={g.id} className="tile">
                <button type="button" className="tile__main" onClick={() => onOpen(g)}>
                  <GarmentIcon garment={g} />
                  <span className="tile__brand">{g.brand}</span>
                  <span className="tile__name">{g.name}</span>
                  <span className="tile__size num">{sizeLine(fit.sizeLabel, recommended)}</span>
                  <span className={`tile__verdict tone-${verdict.tone}`}>{verdict.headline}</span>
                  <GarmentBadge garment={g} />
                </button>
                <div className="tile__actions">
                  <FoldersButton count={folderCount(g.id)} onClick={() => onFolders(g)} />
                  <button
                    type="button"
                    className="tile__unlike"
                    aria-label={`Unlike ${g.brand} ${g.name}`}
                    title="Unlike"
                    onClick={() => onUnlike(g.id)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
