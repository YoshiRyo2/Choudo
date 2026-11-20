import type { GarmentFit, GarmentOdds, MeasureHint, PreferenceSpec, ZoneOdds } from '../../domain/fit';
import type { Garment } from '../../domain/garments';
import {
  describeZone,
  ESTIMATED_MARK,
  formatDiff,
  formatLength,
  GRADE_EXPLAINED,
  LABEL_TEXT,
  labelOddsText,
  measureHintText,
  personalOddsText,
  preferenceNote,
  sourceLine,
  summarize,
  verdictLine,
  zoneName,
} from '../fitText';
import { GarmentBadge } from './GarmentBadge';
import type { UnitSystem } from '../state/stored';
import { TapeScale } from './TapeScale';
import './FitReadout.css';

interface FitReadoutProps {
  garment: Garment;
  fit: GarmentFit;
  units: UnitSystem;
  /** Sampled odds for every size of this garment. */
  odds: GarmentOdds;
  preference: PreferenceSpec;
  /** The measurement that would decide between sizes, if any. */
  hint: MeasureHint | null;
  /** Show each zone's chances (the fit details sheet). */
  showOdds?: boolean;
  /** Opens the fit details sheet; leave out where the readout already is one. */
  onDetails?: () => void;
  onEditBody: () => void;
}

/** How the chosen size fits, zone by zone, measured against the body and what the user likes. */
export function FitReadout({ garment, fit, units, odds, preference, hint, showOdds, onDetails, onEditBody }: FitReadoutProps) {
  const summary = summarize(fit);
  const verdict = verdictLine(odds, fit.sizeLabel, garment);
  const sizeOdds = odds.sizes.find((s) => s.sizeLabel === fit.sizeLabel);
  const hasLengthPreference = preference.anchor?.lengthCm != null;
  return (
    <section className="readout" aria-labelledby="readout-title">
      <header className={`readout__summary tone-${verdict.tone}`}>
        <h2 id="readout-title" className="readout__headline">
          {verdict.headline}
          <span className="readout__size">
            {' '}
            in {fit.sizeLabel}
          </span>
        </h2>
        {verdict.verdict === 'unknown'
          ? summary.detail && <p className="readout__detail">{summary.detail}</p>
          : verdict.detail && <p className="readout__detail">{verdict.detail}</p>}
        {garment.category === 'top' && verdict.verdict !== 'unknown' && (
          <p className="readout__pref">{preferenceNote(preference)}</p>
        )}
        {onDetails && (
          <button type="button" className="button button--outline button--small readout__details" onClick={onDetails}>
            Fit details
          </button>
        )}
      </header>

      {hint && (
        <p className="readout__hint">
          {measureHintText(hint, fit.bodyType)}{' '}
          <button type="button" className="link-button" onClick={onEditBody}>
            Add it
          </button>
        </p>
      )}

      <ul className="readout__zones">
        {fit.zones.map((z) => (
          <li key={z.zone} className="zone">
            <div className="zone__head">
              <span className="zone__name">{zoneName(z.zone, fit.bodyType)}</span>
              <span className={`zone__label tone-${z.tone}`}>{LABEL_TEXT[z.label]}</span>
              {z.diffCm !== null && <span className="zone__diff num">{formatDiff(z.diffCm, units)}</span>}
            </div>
            {z.diffCm !== null && z.kind !== 'landing' && (
              <TapeScale diffCm={z.diffCm} bands={z.bands} units={units} kind={z.kind} />
            )}
            <p className="zone__text">{describeZone(z, units, fit.bodyType)}</p>
            {showOdds && <ZoneOddsLines odds={sizeOdds?.zones.find((o) => o.zone === z.zone)} garment={garment} hasLengthPreference={hasLengthPreference} />}
            <p className="zone__numbers">
              <span>
                You <span className="num">{formatLength(z.bodyCm, units)}</span>
                {z.bodySource === 'estimated' && <span className="zone__est"> estimated</span>}
              </span>
              {z.garmentCm !== null && z.diffCm !== null && (
                <span>
                  This size <span className="num">{formatLength(z.garmentCm, units)}</span>
                  {z.garmentOrigin === 'estimated' && (
                    <abbr className="zone__est" title="Estimated: not printed on the size chart">
                      {' '}
                      {ESTIMATED_MARK}
                    </abbr>
                  )}
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>

      {/* With an anchor tee, a top's chest estimate cancels out, so measuring wouldn't help. */}
      {!hint && summary.usesEstimates && !(garment.category === 'top' && preference.source === 'anchor') && (
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

/** A zone's chances: against what the user likes (tops), then the objective labels. */
function ZoneOddsLines({
  odds,
  garment,
  hasLengthPreference,
}: {
  odds: ZoneOdds | undefined;
  garment: Garment;
  hasLengthPreference: boolean;
}) {
  if (!odds || odds.labels.unknown === 1) return null;
  const personal = personalOddsText(odds, garment, hasLengthPreference);
  return (
    <dl className="zone__odds">
      {personal && (
        <div>
          <dt>For you</dt>
          <dd className="num">{personal}</dd>
        </div>
      )}
      <div>
        <dt>Label</dt>
        <dd className="num">{labelOddsText(odds)}</dd>
      </div>
    </dl>
  );
}

/** Where the numbers came from, and how far to trust them. */
function SourceNote({ garment }: { garment: Garment }) {
  const { source } = garment;
  if (source.placeholder) {
    return (
      <footer className="readout__source is-placeholder">
        <p>Sample data: these numbers were made up for testing and aren’t a real size chart.</p>
      </footer>
    );
  }
  return (
    <footer className="readout__source">
      <p className="readout__grade">
        <GarmentBadge garment={garment} /> {GRADE_EXPLAINED[garment.grade]}
      </p>
      <p>
        {sourceLine(garment)}{' '}
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            View the chart
          </a>
        )}
      </p>
      {source.notes && <p className="readout__source-note">{source.notes}</p>}
    </footer>
  );
}
