import { useEffect, useRef, type ReactNode } from 'react';
import type { Garment } from '@choudo/core/domain/garments';
import { CHECK_TEXT } from '@choudo/core/ui-logic/checkText';
import { GarmentBadge } from './GarmentBadge';
import { GarmentIcon } from './GarmentIcon';
import './GarmentCarousel.css';

interface GarmentCarouselProps {
  label: string;
  garments: Garment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** A small control in the header row, after the count (the fitting room's Show chip). */
  headerAction?: ReactNode;
  /** Ids of the garments read from pasted links (tagged "From your link"). */
  fromLink?: ReadonlySet<string>;
}

/**
 * Swipe sideways through garments. Whichever card settles in the middle is
 * selected; tapping a card or using the arrow buttons does the same.
 */
export function GarmentCarousel({ label, garments, selectedId, onSelect, headerAction, fromLink }: GarmentCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const selectedIndex = Math.max(0, garments.findIndex((g) => g.id === selectedId));

  // Keep the selected card centred when the selection changes from outside.
  useEffect(() => {
    const card = trackRef.current?.children[selectedIndex] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedIndex]);

  // On first render jump straight there, without animating.
  useEffect(() => {
    const card = trackRef.current?.children[selectedIndex] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' }); // only on mount
  }, []);

  function handleScroll() {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      // Measure cards against the track itself, not with offsetLeft: offsetLeft
      // counts from the nearest positioned ancestor, which on wide screens sits
      // hundreds of pixels left of the track, so the first card always looked
      // closest to the middle and every new choice snapped back to it.
      const trackRect = track.getBoundingClientRect();
      const middle = trackRect.left + trackRect.width / 2;
      let closest = 0;
      let best = Infinity;
      Array.from(track.children).forEach((child, i) => {
        const r = child.getBoundingClientRect();
        const distance = Math.abs(r.left + r.width / 2 - middle);
        if (distance < best) {
          best = distance;
          closest = i;
        }
      });
      const id = garments[closest]?.id;
      if (id && id !== selectedId) onSelect(id);
    }, 120);
  }

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const step = (delta: number) => {
    const next = garments[selectedIndex + delta];
    if (next) onSelect(next.id);
  };

  return (
    <div className="carousel">
      <div className="carousel__header">
        <h2 className="carousel__title">{label}</h2>
        <span className="carousel__count num" aria-hidden="true">
          {selectedIndex + 1} of {garments.length}
        </span>
        {headerAction}
        <div className="carousel__arrows">
          <button type="button" onClick={() => step(-1)} disabled={selectedIndex === 0} aria-label={`Previous ${label.toLowerCase()}`}>
            <span className="carousel__arrow carousel__arrow--prev" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={selectedIndex === garments.length - 1}
            aria-label={`Next ${label.toLowerCase()}`}
          >
            <span className="carousel__arrow carousel__arrow--next" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul ref={trackRef} className="carousel__track" onScroll={handleScroll} aria-label={label}>
        {garments.map((g) => {
          const selected = g.id === selectedId;
          return (
            <li key={g.id} className="carousel__item">
              <button
                type="button"
                className={`garment-card${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelect(g.id)}
              >
                <GarmentIcon garment={g} />
                <span className="garment-card__text">
                  <span className="garment-card__brand">{g.brand}</span>
                  <span className="garment-card__name">{g.name}</span>
                  <GarmentBadge garment={g} className="garment-card__flag" />
                  {fromLink?.has(g.id) && <span className="garment-tag garment-card__link">{CHECK_TEXT.fromLink}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
