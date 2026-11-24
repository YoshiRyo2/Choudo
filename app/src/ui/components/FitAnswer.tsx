import type { GarmentOdds } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { fittingHeadline } from '../fitText';
import './FitAnswer.css';

interface FitAnswerProps {
  garment: Pick<Garment, 'category' | 'fitIntent'>;
  /** The size on the mannequin. */
  size: string;
  /** The garment's odds; `odds.recommended` (recommendSize) is the suggested size, or null. */
  odds: GarmentOdds;
}

/**
 * The Fitting room's plain answer: "M fits you" (or "Your best bet: M") and one verdict line for the size shown.
 * No numbers here; they're in the Fit details sheet. Wording is fitText's.
 */
export function FitAnswer({ garment, size, odds }: FitAnswerProps) {
  const answer = fittingHeadline(odds, size, garment);
  return (
    <div className="fit-answer" aria-live="polite">
      <p className={`fit-answer__headline${odds.recommended ? '' : ' is-fallback'}`}>{answer.headline}</p>
      <p className="fit-answer__line">
        <span className={`fit-answer__dot tone-${answer.tone}`} aria-hidden="true" />
        {answer.line}
      </p>
    </div>
  );
}

