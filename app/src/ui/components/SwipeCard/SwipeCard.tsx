import { useRef, useState, type PointerEvent } from 'react';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import type { GarmentFit } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { sizeLine, type VerdictLine } from '@choudo/core/ui-logic/fitText';
import { GarmentBadge } from '../GarmentBadge';
import { Mannequin } from '../Mannequin/Mannequin';
import { DISTANCE_SHARE, swipeOutcome, tilt, type SwipeOutcome } from '@choudo/core/ui-logic/components/SwipeCard/swipe';
import './SwipeCard.css';

interface SwipeCardProps {
  garment: Garment;
  body: BodyMeasurements;
  fit: GarmentFit;
  /** Whether `fit.sizeLabel` is the recommended size (false = fallback). */
  recommended: boolean;
  /** The personal verdict for the size shown. */
  verdict: VerdictLine;
  /** Set while the card flies off after a decision. */
  leaving: SwipeOutcome;
  /** Only the top card can be dragged. */
  interactive: boolean;
  onDecide: (outcome: 'like' | 'pass') => void;
  onOpen: () => void;
}

/** Movement under this (px) is a tap, not a drag. */
const TAP_SLOP = 6;

/** One garment on the user's mannequin. Drag right to like, left to pass, tap for details. */
export function SwipeCard({ garment, body, fit, recommended, verdict, leaving, interactive, onDecide, onOpen }: SwipeCardProps) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ startX: number; lastX: number; lastT: number; velocity: number } | null>(null);
  const [dx, setDx] = useState(0);
  const worn = { garment, sizeLabel: fit.sizeLabel, fit };

  function down(e: PointerEvent) {
    if (!interactive || leaving || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, lastX: e.clientX, lastT: e.timeStamp, velocity: 0 };
  }

  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    setDx(e.clientX - d.startX);
  }

  function up(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const moved = e.clientX - d.startX;
    if (Math.abs(moved) < TAP_SLOP) {
      setDx(0);
      onOpen();
      return;
    }
    const outcome = swipeOutcome(moved, d.velocity, ref.current?.offsetWidth ?? 320);
    if (outcome) onDecide(outcome);
    else setDx(0);
  }

  function cancel() {
    drag.current = null;
    setDx(0);
  }

  const width = ref.current?.offsetWidth ?? 320;
  const dragging = drag.current !== null;
  const offset = leaving === 'like' ? width * 1.4 : leaving === 'pass' ? -width * 1.4 : dx;
  const lean = leaving ? Math.sign(offset) * 14 : tilt(dx, width);
  // How sure the drag looks so far, 0..1, for the Like / Pass stamps.
  const intent = leaving ? 1 : Math.min(1, Math.abs(dx) / (width * DISTANCE_SHARE));

  return (
    <article
      ref={ref}
      className={`swipe-card${dragging ? ' is-dragging' : ''}${leaving ? ' is-leaving' : ''}`}
      style={{ transform: `translateX(${offset}px) rotate(${lean}deg)` }}
      aria-label={`${garment.brand} ${garment.name}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
    >
      <div className="swipe-card__stage">
        <Mannequin
          body={body}
          top={garment.category === 'top' ? worn : undefined}
          bottom={garment.category === 'bottom' ? worn : undefined}
          onepiece={garment.category === 'onepiece' ? worn : undefined}
          outer={garment.category === 'outer' ? worn : undefined}
          showFit={false}
          frame="body"
          face={verdict.tone}
        />
        <span className="swipe-card__stamp is-like" style={{ opacity: offset > 0 ? intent : 0 }} aria-hidden="true">
          Like
        </span>
        <span className="swipe-card__stamp is-pass" style={{ opacity: offset < 0 ? intent : 0 }} aria-hidden="true">
          Pass
        </span>
      </div>
      <div className="swipe-card__info">
        <p className="swipe-card__brand">
          {garment.brand}
          <GarmentBadge garment={garment} />
        </p>
        <h2 className="swipe-card__name">{garment.name}</h2>
        <p className="swipe-card__size num">{sizeLine(fit.sizeLabel, recommended)}</p>
        <p className={`swipe-card__verdict tone-${verdict.tone}`}>
          <span className="swipe-card__dot" aria-hidden="true" />
          {verdict.headline}
        </p>
      </div>
    </article>
  );
}
