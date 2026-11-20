import type { GarmentFit, GarmentOdds } from '../../domain/fit';
import type { Garment } from '../../domain/garments';
import { summarize, verdictLine } from '../fitText';
import { SizePicker } from './SizePicker';
import './FitStrip.css';

interface FitStripProps {
  garment: Garment;
  /** Every size of the garment, in chart order. */
  fits: GarmentFit[];
  size: string;
  recommended: string | null;
  odds: GarmentOdds;
  onSelectSize: (size: string) => void;
  /** Opens the fit details sheet. */
  onDetails: () => void;
}

/**
 * The fitting room's at-a-glance answer, right under the mannequin: the sizes in
 * one sideways row, then one verdict line with its odds. Wording is fitText's.
 */
export function FitStrip({ garment, fits, size, recommended, odds, onSelectSize, onDetails }: FitStripProps) {
  const fit = fits.find((f) => f.sizeLabel === size);
  const verdict = verdictLine(odds, size, garment);
  // As FitReadout's summary: with no verdict, say what couldn't be checked instead of odds.
  const detail = verdict.verdict === 'unknown' ? (fit ? summarize(fit).detail : null) : verdict.detail;
  return (
    <div className="fit-strip">
      <SizePicker key={garment.id} layout="row" fits={fits} selected={size} recommended={recommended} onSelect={onSelectSize} />
      <div className={`fit-strip__verdict tone-${verdict.tone}`}>
        <p className="fit-strip__text" aria-live="polite">
          <span className="fit-strip__headline">{verdict.headline}</span>
          {detail && <span className="fit-strip__odds">{detail}</span>}
        </p>
        <button type="button" className="button button--outline button--small fit-strip__details" onClick={onDetails}>
          Fit details
        </button>
      </div>
    </div>
  );
}
