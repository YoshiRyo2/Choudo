import type { GarmentFit, GarmentOdds, MeasureHint, PreferenceSpec, ZoneOdds } from '@choudo/core/domain/fit';
import { templateOf, type Garment } from '@choudo/core/domain/garments';
import {
  bodyPlaceText,
  describeZone,
  ESTIMATED_MARK,
  formatDiff,
  formatLength,
  GRADE_EXPLAINED,
  headlineSize,
  labelOddsText,
  measureHintAction,
  measureHintText,
  personalOddsText,
  preferenceNote,
  sourceLine,
  summarize,
  wornOverText,
  verdictLine,
  zoneLabelText,
  zoneTitle,
  objectiveOnly,
} from '@choudo/core/ui-logic/fitText';
import { GarmentBadge } from './GarmentBadge';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
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
  /**
   * Show the headline, its odds and the Fit details button (default). The fitting
   * room turns it off: its fit strip already shows them.
   */
  summary?: boolean;
  /** How the layers sit together, already worded (a jacket over a hoodie). */
  layerNotes?: readonly string[];
  onEditBody: () => void;
}

/** How the chosen size fits, zone by zone, measured against the body and what the user likes. */
export function FitReadout({
  garment,
  fit,
  units,
  odds,
  preference,
  hint,
  showOdds,
  onDetails,
  summary: showSummary = true,
  layerNotes = [],
  onEditBody,
}: FitReadoutProps) {
  const template = templateOf(garment);
  const summary = summarize(fit, template);
  const verdict = verdictLine(odds, fit.sizeLabel, garment);
  // A close call already names its sizes: "Could go either way: 8 or 10", not "… in 8".
  const namedSize = headlineSize(verdict, fit.sizeLabel);
  const sizeOdds = odds.sizes.find((s) => s.sizeLabel === fit.sizeLabel);
  const hasLengthPreference = preference.anchor?.lengthCm != null;
  const prefNote = !objectiveOnly(garment) && verdict.verdict !== 'unknown' ? preferenceNote(preference) : null;
  const over = wornOverText(fit);
  return (
    <section className="readout" aria-labelledby={showSummary ? 'readout-title' : undefined}>
      {showSummary ? (
        <header className={`readout__summary tone-${verdict.tone}`}>
          <h2 id="readout-title" className="readout__headline">
            {verdict.headline}
            {namedSize && (
              <span className="readout__size">
                {' '}
                in {namedSize}
              </span>
            )}
          </h2>
          {verdict.verdict === 'unknown'
            ? summary.detail && <p className="readout__detail">{summary.detail}</p>
            : verdict.detail && <p className="readout__detail">{verdict.detail}</p>}
          {prefNote && <p className="readout__pref">{prefNote}</p>}
          {onDetails && (
            <button type="button" className="button button--outline button--small readout__details" onClick={onDetails}>
              Fit details
            </button>
          )}
        </header>
      ) : (
        // The headline lives elsewhere (the fit strip); what it's compared with stays here.
        prefNote && <p className="readout__pref">{prefNote}</p>
      )}

      {over && (
        <div className="readout__layer">
          <p className="readout__over">{over}</p>
          {layerNotes.length > 0 && (
            <ul className="readout__notes">
              {layerNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hint && (
        <p className="readout__hint">
          {measureHintText(hint, fit.bodyType)}{' '}
          <button type="button" className="link-button" onClick={onEditBody}>
            {measureHintAction(hint, fit.bodyType)}
          </button>
        </p>
      )}

      <ul className="readout__zones">
        {fit.zones.map((z) => (
          <li key={z.zone} className="zone">
            <div className="zone__head">
              <span className="zone__name">{zoneTitle(z, fit.bodyType)}</span>
              <span className={`zone__label tone-${z.tone}`}>{zoneLabelText(z, template)}</span>
              {z.diffCm !== null && <span className="zone__diff num">{formatDiff(z.diffCm, units)}</span>}
            </div>
            {z.diffCm !== null && z.kind !== 'landing' && (
              <TapeScale diffCm={z.diffCm} bands={z.bands} units={units} kind={z.kind} />
            )}
            <p className="zone__text">{describeZone(z, units, fit.bodyType, template)}</p>
            {showOdds && <ZoneOddsLines odds={sizeOdds?.zones.find((o) => o.zone === z.zone)} garment={garment} hasLengthPreference={hasLengthPreference} />}
            <p className="zone__numbers">
              <span>
                You <span className="num">{formatLength(z.bodyCm, units)}</span>
                {bodyPlaceText(z, fit.over)}
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
      {!hint && summary.usesEstimates && !(!objectiveOnly(garment) && preference.source === 'anchor') && (
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
  // A landing zone that never blocks has no label odds to give.
  const labels = labelOddsText(odds);
  if (!personal && labels === '') return null;
  return (
    <dl className="zone__odds">
      {personal && (
        <div>
          <dt>For you</dt>
          <dd className="num">{personal}</dd>
        </div>
      )}
      {labels !== '' && (
        <div>
          <dt>Label</dt>
          <dd className="num">{labels}</dd>
        </div>
      )}
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
