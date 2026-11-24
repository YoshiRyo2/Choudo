import { useEffect, useMemo, useState } from 'react';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import { catalogueFor, GARMENTS, type CatalogueScope, type Garment } from '@choudo/core/domain/garments';
import { catalogueOptions, endOfMatchingFeedText } from '../catalogueText';
import { SegmentedControl } from '../components/SegmentedControl';
import { FitSheet } from '../components/FitSheet';
import { SwipeCard } from '../components/SwipeCard/SwipeCard';
import type { SwipeOutcome } from '../components/SwipeCard/swipe';
import { buildFeed } from '../state/feed';
import { verdictLine } from '../fitText';
import { garmentOdds } from '../state/odds';
import { suggestedFit } from '../state/outfit';
import type { UnitSystem } from '../state/stored';
import type { Closet } from '../state/useCloset';
import './Discover.css';

interface DiscoverProps {
  /** Show garments for the user's body type (plus unisex), or all of them. The feed is built once per scope. */
  catalogue: CatalogueScope;
  onCatalogueChange: (scope: CatalogueScope) => void;
  body: BodyInput;
  preference: PreferenceSpec;
  units: UnitSystem;
  closet: Closet;
  onTryOn: (garment: Garment, size: string) => void;
  onEditBody: () => void;
  onOpenCloset: () => void;
}

/** How long the card takes to fly off before the next one is shown (ms). */
const LEAVE_MS = 220;

/** A feed of garments on your mannequin, one card at a time. */
export function Discover({
  catalogue,
  onCatalogueChange,
  body,
  preference,
  units,
  closet,
  onTryOn,
  onEditBody,
  onOpenCloset,
}: DiscoverProps) {
  const model = useMemo(() => estimateBody(body), [body]);
  // The feed is fixed when the screen opens, so swiping doesn't reshuffle it.
  const [feed] = useState(() => buildFeed(catalogueFor(GARMENTS, body.bodyType, catalogue), closet.swipes));
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<SwipeOutcome>(null);
  const [details, setDetails] = useState<Garment | null>(null);

  const card = (garment: Garment | undefined) => {
    if (!garment) return null;
    const suggested = suggestedFit(model, garment, preference);
    const verdict = verdictLine(garmentOdds(model, garment, preference), suggested.fit.sizeLabel, garment);
    return { garment, ...suggested, verdict };
  };
  const current = card(feed[index]);
  const next = card(feed[index + 1]);

  function decide(outcome: 'like' | 'pass') {
    if (!current || leaving) return;
    setLeaving(outcome);
    closet.swipe(current.garment.id, current.fit.sizeLabel, outcome === 'like');
    window.setTimeout(() => {
      setLeaving(null);
      setIndex((i) => i + 1);
    }, LEAVE_MS);
  }

  // Arrow keys like and pass, while no details sheet is open.
  useEffect(() => {
    if (!current || details) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') decide('like');
      else if (e.key === 'ArrowLeft') decide('pass');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const left = feed.length - index;

  return (
    <main className="discover">
      <header className="screen-head">
        <h1>Discover</h1>
        {current && <span className="screen-head__meta num">{left} to go</span>}
      </header>
      <div className="discover__scope">
        <SegmentedControl
          label="Show"
          hideLabel
          value={catalogue}
          options={catalogueOptions(body.bodyType)}
          onChange={onCatalogueChange}
        />
      </div>

      {current ? (
        <>
          <section className="discover__deck" aria-label="Garment cards">
            {next && (
              <div className="swipe-card is-next" aria-hidden="true" key={`next-${next.garment.id}`}>
                {/* A plain stand-in keeps the second mannequin from rendering twice per swipe. */}
              </div>
            )}
            <SwipeCard
              key={current.garment.id}
              garment={current.garment}
              body={model.measurements}
              fit={current.fit}
              recommended={current.recommended}
              verdict={current.verdict}
              leaving={leaving}
              interactive={!details}
              onDecide={decide}
              onOpen={() => setDetails(current.garment)}
            />
          </section>

          <div className="discover__actions">
            <button type="button" className="discover__action is-pass" onClick={() => decide('pass')} aria-label="Pass">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <button type="button" className="button button--outline button--small" onClick={() => setDetails(current.garment)}>
              Fit details
            </button>
            <button type="button" className="discover__action is-like" onClick={() => decide('like')} aria-label="Like">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
              </svg>
            </button>
          </div>
        </>
      ) : (
        <section className="empty-state discover__end">
          <h2>No more garments</h2>
          {catalogue === 'matching' ? (
            <>
              <p>{endOfMatchingFeedText(body.bodyType)}</p>
              <button type="button" className="button button--outline" onClick={() => onCatalogueChange('all')}>
                Show all garments
              </button>
            </>
          ) : (
            <p>You’ve seen everything we have for now. New garments will show up here as we add them.</p>
          )}
          {closet.liked.length > 0 && (
            <button type="button" className="button button--primary" onClick={onOpenCloset}>
              See your {closet.liked.length} liked in the Closet
            </button>
          )}
        </section>
      )}

      {details && current && (
        <FitSheet
          garment={details}
          model={model}
          preference={preference}
          size={current.fit.sizeLabel}
          units={units}
          onClose={() => setDetails(null)}
          onTryOn={(size) => onTryOn(details, size)}
          onEditBody={onEditBody}
        />
      )}
    </main>
  );
}
