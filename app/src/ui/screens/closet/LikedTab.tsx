import { useState } from 'react';
import type { BodyModel } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import { categoriesIn, type Garment, type GarmentCategory } from '@choudo/core/domain/garments';
import { GarmentBadge } from '../../components/GarmentBadge';
import { GarmentIcon } from '../../components/GarmentIcon';
import { SegmentedControl } from '../../components/SegmentedControl';
import { sizeLine, verdictLine } from '@choudo/core/ui-logic/fitText';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { shownLikes } from '@choudo/core/ui-logic/state/closet';
import { suggestedFit } from '@choudo/core/ui-logic/state/outfit';
import { FoldersButton } from './FolderPicker';

type Filter = 'all' | GarmentCategory;

interface LikedTabProps {
  model: BodyModel;
  preference: PreferenceSpec;
  /** Every garment the app may show: likes for any other (a sample on the public site, or gone) are skipped. */
  garments: readonly Garment[];
  likedIds: string[];
  onOpen: (garment: Garment) => void;
  onUnlike: (garmentId: string) => void;
  /** How many folders a garment is in. */
  folderCount: (garmentId: string) => number;
  onFolders: (garment: Garment) => void;
  onOpenDiscover: () => void;
}

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'top', label: 'Tops' },
  { value: 'bottom', label: 'Bottoms' },
  { value: 'outer', label: 'Jackets' },
  { value: 'onepiece', label: 'Dresses' },
];

const FILTER_WORD: Record<Filter, string> = { all: 'garments', top: 'tops', bottom: 'bottoms', outer: 'jackets', onepiece: 'dresses' };

/** Everything you've liked, newest first, filterable by tops, bottoms, jackets and dresses. */
export function LikedTab({ model, preference, garments, likedIds, onOpen, onUnlike, folderCount, onFolders, onOpenDiscover }: LikedTabProps) {
  const [picked, setFilter] = useState<Filter>('all');
  // Likes for garments the catalogue doesn't show (gone, or a sample on the public site) are skipped; storage keeps them.
  const liked = shownLikes(likedIds, garments);
  // A category with no garments at all gets no filter.
  const inCatalogue = categoriesIn(garments);
  const filters = FILTERS.filter((f) => f.value === 'all' || inCatalogue.has(f.value));
  const filter = filters.some((f) => f.value === picked) ? picked : 'all';
  const shown = filter === 'all' ? liked : liked.filter((g) => g.category === filter);

  if (liked.length === 0) {
    return (
      <section className="empty-state">
        <h2>Nothing liked yet</h2>
        <p>Tap the heart in Discover, or swipe right, to keep a garment here.</p>
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
        options={filters.map((f) => (f.value === 'all' ? { value: f.value, label: `All ${liked.length}` } : f))}
        onChange={setFilter}
      />
      {shown.length === 0 ? (
        <p className="closet__note">No liked {FILTER_WORD[filter]} yet.</p>
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
