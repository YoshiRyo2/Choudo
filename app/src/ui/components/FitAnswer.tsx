import type { GarmentFit, GarmentOdds } from '@choudo/core/domain/fit';
import { templateOf, type Garment } from '@choudo/core/domain/garments';
import { fittingHeadline, reliabilityAction, reliabilityText, whyLine } from '@choudo/core/ui-logic/fitText';
import { reliability } from '@choudo/core/ui-logic/reliability';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import './FitAnswer.css';

interface FitAnswerProps {
  garment: Pick<Garment, 'category' | 'fitIntent' | 'grade' | 'type'>;
  /** The size on the mannequin. */
  size: string;
  /** The garment's odds; `odds.recommended` (recommendSize) is the suggested size, or null. */
  odds: GarmentOdds;
  /** Every size's fit, in chart order (the why-line compares this size with the next). */
  fits: readonly GarmentFit[];
  units: UnitSystem;
  /** The user has a fit reference (a tee they own and like). */
  hasFitReference: boolean;
  /** The bust came from a bra size, not from height and weight. */
  bustFromBra?: boolean;
  /** "Add your measurement" opens Edit body. */
  onEditBody: () => void;
}

/**
 * The Fitting room's plain answer: "M fits you" (or "Your best bet: M"), the verdict line for
 * the size shown, why in cm at the deciding girth, and how far to trust it. No percentages
 * (odds are Test mode only) and no zone readout: those are in the Fit details sheet. Wording is fitText's.
 */
export function FitAnswer({ garment, size, odds, fits, units, hasFitReference, bustFromBra, onEditBody }: FitAnswerProps) {
  const answer = fittingHeadline(odds, size, garment);
  const fit = fits.find((f) => f.sizeLabel === size);
  const why = fit ? whyLine(fits, size, templateOf(garment), units, fit.bodyType) : null;
  const trust = fit ? reliability(fit, garment, { hasFitReference }) : null;
  const action = trust ? reliabilityAction(trust) : null;
  return (
    <div className="fit-answer" aria-live="polite">
      <p className={`fit-answer__headline${odds.recommended ? '' : ' is-fallback'}`}>{answer.headline}</p>
      <p className="fit-answer__line">
        <span className={`fit-answer__dot tone-${answer.tone}`} aria-hidden="true" />
        {answer.line}
      </p>
      {why && <p className="fit-answer__why">{why}</p>}
      {trust && fit && (
        <p className={`fit-answer__trust is-${trust.level}`}>
          {reliabilityText(trust, fit.bodyType, { bustFromBra })}
          {action && (
            <>
              {' '}
              <button type="button" className="link-button" onClick={onEditBody}>
                {action}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
