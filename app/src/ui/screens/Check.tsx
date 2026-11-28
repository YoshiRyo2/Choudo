import { useState } from 'react';
import type { BodyModel } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { brandText, canRetry, CHECK_TEXT, checkErrorText } from '@choudo/core/ui-logic/checkText';
import type { ReadyFetched } from '@choudo/core/ui-logic/state/fetched';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import type { CheckState } from '../../links/useLinkCheck';
import { GarmentIcon } from '../components/GarmentIcon';
import { ResultCard } from './check/ResultCard';
import './Check.css';

export interface CheckProps {
  model: BodyModel;
  preference: PreferenceSpec;
  units: UnitSystem;
  hasFitReference: boolean;
  state: CheckState;
  /** The latest fetched products, newest first (at most RECENT_CHECKS). */
  recent: readonly ReadyFetched[];
  onCheck: (text: string) => void;
  onRetry: () => void;
  onOpenRecent: (garmentId: string) => void;
  /** Wear it in the Fitting room in this size, then go there. */
  onTryOn: (garment: Garment, size: string) => void;
  onEditBody: () => void;
  /** A colour chip: store the checked product in that colour. */
  onColor: (garmentId: string, colorCode: string) => void;
  /** Test mode only: hosts of pasted links Choudo couldn't read. */
  unsupportedHosts?: readonly string[];
}

/**
 * The Check tab, where the site opens (the phone's CheckScreen): paste a Uniqlo US or Zara US product
 * link, see the size to buy, why, and how far to trust it. Loading and errors show inline,
 * under the field. Enter in the field checks.
 */
export function Check({
  model,
  preference,
  units,
  hasFitReference,
  state,
  recent,
  onCheck,
  onRetry,
  onOpenRecent,
  onTryOn,
  onEditBody,
  onColor,
  unsupportedHosts,
}: CheckProps) {
  const [text, setText] = useState('');
  const loading = state.kind === 'loading';
  const shownId = state.kind === 'result' ? state.fetched.garment.id : null;
  const others = recent.filter((r) => r.garment.id !== shownId);

  return (
    <main className="check">
      <header className="screen-head">
        <h1>{CHECK_TEXT.title}</h1>
      </header>

      <form
        className="check__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) onCheck(text);
        }}
      >
        <label className="visually-hidden" htmlFor="check-link">
          {CHECK_TEXT.field}
        </label>
        <input
          id="check-link"
          className="check__input"
          type="url"
          inputMode="url"
          enterKeyHint="go"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder={CHECK_TEXT.field}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="button button--primary" aria-disabled={loading}>
          {CHECK_TEXT.submit}
        </button>
        <p className="check__scope">{CHECK_TEXT.scope}</p>
      </form>

      <div aria-live="polite" className="check__status">
        {state.kind === 'loading' && <p data-testid="check-loading">{brandText(state.brand).loading}</p>}
        {state.kind === 'error' && (
          <div className="check__error" data-testid="check-error">
            <p role="alert">{checkErrorText(state.error, state.brand)}</p>
            {canRetry(state.error) && (
              <button type="button" className="button button--outline button--small" onClick={onRetry}>
                {CHECK_TEXT.retry}
              </button>
            )}
          </div>
        )}
      </div>

      {state.kind === 'result' && (
        <ResultCard
          key={state.fetched.garment.id}
          fetched={state.fetched}
          model={model}
          preference={preference}
          units={units}
          hasFitReference={hasFitReference}
          onTryOn={onTryOn}
          onEditBody={onEditBody}
          onColor={(code) => onColor(state.fetched.garment.id, code)}
        />
      )}

      {others.length > 0 && (
        <section className="check__recent" aria-labelledby="check-recent-title" data-testid="check-recent">
          <h2 id="check-recent-title">{CHECK_TEXT.recent}</h2>
          <ul>
            {others.map((r) => (
              <li key={r.garment.id}>
                <button
                  type="button"
                  className="check__recent-row"
                  aria-label={`${r.garment.brand} ${r.garment.name}`}
                  onClick={() => onOpenRecent(r.garment.id)}
                >
                  <span className="check__recent-icon">
                    <GarmentIcon garment={r.garment} />
                  </span>
                  <span className="check__recent-text">
                    <span className="check__recent-name">{r.garment.name}</span>
                    <span className="check__recent-meta">
                      {r.product.priceText ? `${r.garment.brand} · ${r.product.priceText}` : r.garment.brand}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unsupportedHosts && unsupportedHosts.length > 0 && (
        <p className="check__hosts" data-testid="unsupported-hosts">
          {CHECK_TEXT.unsupportedHosts}: {unsupportedHosts.join(', ')}
        </p>
      )}
    </main>
  );
}
