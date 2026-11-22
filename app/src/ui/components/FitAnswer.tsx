import type { GarmentOdds } from '../../domain/fit';
import type { Garment } from '../../domain/garments';
import { fittingHeadline, verdictLine } from '../fitText';
import './FitAnswer.css';

interface FitAnswerProps {
  garment: Pick<Garment, 'category' | 'fitIntent'>;
  /** The size on the mannequin. */
  size: string;
  /** The suggested size (recommendSize, via the garment's odds), or null when none could be picked. */
  recommended: string | null;
  odds: GarmentOdds;
}

/**
 * The Fitting room's plain answer: "M fits you" and one verdict line for the size shown.
 * No numbers here; they're in the Fit details sheet. Wording is fitText's.
 */
export function FitAnswer({ garment, size, recommended, odds }: FitAnswerProps) {
  const answer = fittingHeadline(recommended, size, verdictLine(odds, size, garment));
  return (
    <div className="fit-answer" aria-live="polite">
      <p className={`fit-answer__headline${recommended ? '' : ' is-fallback'}`}>{answer.headline}</p>
      <p className="fit-answer__line">
        <span className={`fit-answer__dot tone-${answer.tone}`} aria-hidden="true" />
        {answer.line}
      </p>
    </div>
  );
}

