import type { GarmentFit } from '../../domain/fit';
import type { Garment } from '../../domain/garments';
import { describeZone, formatDiff, formatLength, LABEL_TEXT, summarize, ZONE_NAME } from '../fitText';
import type { UnitSystem } from '../state/stored';
import { TapeScale } from './TapeScale';
import './FitReadout.css';

interface FitReadoutProps {
  garment: Garment;
  fit: GarmentFit;
  units: UnitSystem;
  onEditBody: () => void;
}

/** How the chosen size fits, zone by zone, measured against the body. */
export function FitReadout({ garment, fit, units, onEditBody }: FitReadoutProps) {
  const summary = summarize(fit);
  return (
    <section className="readout" aria-labelledby="readout-title">
      <header className={`readout__summary tone-${fit.overall}`}>
        <h2 id="readout-title" className="readout__headline">
          {summary.headline}
          <span className="readout__size">
            {' '}
            in {fit.sizeLabel}
          </span>
        </h2>
        {summary.detail && <p className="readout__detail">{summary.detail}</p>}
      </header>

      <ul className="readout__zones">
        {fit.zones.map((z) => (
          <li key={z.zone} className="zone">
            <div className="zone__head">
              <span className="zone__name">{ZONE_NAME[z.zone]}</span>
              <span className={`zone__label tone-${z.tone}`}>{LABEL_TEXT[z.label]}</span>
              {z.diffCm !== null && <span className="zone__diff num">{formatDiff(z.diffCm, units)}</span>}
            </div>
            {z.diffCm !== null && <TapeScale diffCm={z.diffCm} bands={z.bands} units={units} kind={z.kind} />}
            <p className="zone__text">{describeZone(z, units)}</p>
            <p className="zone__numbers">
              <span>
                You <span className="num">{formatLength(z.bodyCm, units)}</span>
                {z.bodySource === 'estimated' && <span className="zone__est"> estimated</span>}
              </span>
              {z.garmentCm !== null && z.diffCm !== null && (
                <span>
                  This size <span className="num">{formatLength(z.garmentCm, units)}</span>
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>

      {summary.usesEstimates && (
        <p className="readout__estimates">
          Some of your numbers are estimates from height and weight.{' '}
          <button type="button" className="link-button" onClick={onEditBody}>
            Add your own measurements
          </button>{' '}
          for a surer answer.
        </p>
      )}

      <SourceNote garment={garment} />
    </section>
  );
}

function SourceNote({ garment }: { garment: Garment }) {
  const { source } = garment;
  if (source.placeholder) {
    return (
      <p className="readout__source is-placeholder">
        Sample data: these numbers were made up for testing and aren’t a real size chart.
      </p>
    );
  }
  const date = source.capturedOn
    ? new Date(`${source.capturedOn}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <p className="readout__source">
      From {garment.brand}’s size chart{date ? `, copied ${date}` : ''}.{' '}
      {source.url && (
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          View the chart
        </a>
      )}
      {source.notes && <span className="readout__source-note"> {source.notes}</span>}
    </p>
  );
}
