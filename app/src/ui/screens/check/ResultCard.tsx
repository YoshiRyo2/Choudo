import { useMemo, useState } from 'react';
import type { BodyModel } from '@choudo/core/domain/body';
import { fitAllSizes, type PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { CHECK_TEXT, colourLabel } from '@choudo/core/ui-logic/checkText';
import { fittingHeadline } from '@choudo/core/ui-logic/fitText';
import type { ReadyFetched } from '@choudo/core/ui-logic/state/fetched';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { middleSize } from '@choudo/core/ui-logic/state/outfit';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import { uniqloPhoto } from '../../../links/fetchUniqlo';
import { FitAnswer } from '../../components/FitAnswer';
import { GarmentIcon } from '../../components/GarmentIcon';
import { Mannequin } from '../../components/Mannequin/Mannequin';
import { SizePicker } from '../../components/SizePicker';

export interface ResultCardProps {
  fetched: ReadyFetched;
  model: BodyModel;
  preference: PreferenceSpec;
  units: UnitSystem;
  hasFitReference: boolean;
  onTryOn: (garment: Garment, size: string) => void;
  onEditBody: () => void;
  /** Another of the product's colours: stored with the entry, so the preview and "Try it on" use it. */
  onColor: (colorCode: string) => void;
}

/**
 * One checked product (the phone's ResultCard): name and price; Uniqlo's photo, large and as
 * it is ("Photo: Uniqlo"), beside Choudo's own drawing of it on you in the product's colour
 * and cut; the answer for the suggested size; a chip per colour and per size. Give it a `key`
 * per garment so a new product starts on its own suggested size.
 */
export function ResultCard({ fetched, model, preference, units, hasFitReference, onTryOn, onEditBody, onColor }: ResultCardProps) {
  const { garment, product } = fetched;
  const odds = useMemo(() => garmentOdds(model, garment, preference), [model, garment, preference]);
  const fits = useMemo(() => fitAllSizes(model, garment), [model, garment]);
  const [size, setSize] = useState(() => odds.recommended ?? middleSize(garment));
  const fit = fits.find((f) => f.sizeLabel === size);
  const face = fittingHeadline(odds, size, garment).tone;
  const colorName = product.colorName ? colourLabel(product.colorName) : null;

  return (
    <section className="check-result" aria-labelledby="check-result-name" data-testid="check-result">
      <div className="check-result__product">
        <p className="check-result__brand">{garment.brand}</p>
        <h2 id="check-result-name" className="check-result__name">
          {garment.name}
        </h2>
        <p className="check-result__meta">{[product.priceText, colorName, product.cutText].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="check-result__pictures">
        <figure className="check-result__picture">
          <div className="check-result__frame">
            <ProductPhoto garment={garment} url={product.imageUrl} name={garment.name} />
          </div>
          <figcaption>{CHECK_TEXT.photoCredit}</figcaption>
        </figure>
        <figure className="check-result__picture">
          <button
            type="button"
            className="check-result__frame check-result__preview"
            aria-label={`${CHECK_TEXT.onYou}: ${CHECK_TEXT.tryOn}, ${size}`}
            data-testid="check-preview"
            onClick={() => onTryOn(garment, size)}
          >
            <Mannequin
              body={model.measurements}
              top={{ garment, sizeLabel: size, ...(fit ? { fit } : {}) }}
              showFit={false}
              frame="body"
              showHeightTape={false}
              face={face}
            />
          </button>
          <figcaption>{CHECK_TEXT.onYou}</figcaption>
        </figure>
      </div>

      <FitAnswer
        garment={garment}
        size={size}
        odds={odds}
        fits={fits}
        units={units}
        hasFitReference={hasFitReference}
        bustFromBra={model.bra?.setsBust === true}
        onEditBody={onEditBody}
      />

      {product.colors && product.colors.length > 1 && (
        <div className="check-result__colours">
          <p className="check-result__label" id="check-colour-label">
            {colorName ? `${CHECK_TEXT.colour}: ${colorName}` : CHECK_TEXT.colour}
          </p>
          <div className="check-result__swatches" role="group" aria-labelledby="check-colour-label">
            {product.colors.map((c) => {
              const selected = c.code === product.colorCode;
              return (
                <button
                  key={c.code}
                  type="button"
                  className={`check-result__swatch${selected ? ' is-selected' : ''}`}
                  aria-label={colourLabel(c.name)}
                  aria-pressed={selected}
                  data-testid={`colour-${c.code}`}
                  onClick={() => onColor(c.code)}
                >
                  <span style={{ background: c.hex }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <SizePicker fits={fits} selected={size} recommended={odds.recommended} odds={odds} onSelect={setSize} />

      {product.otherSleeve && (
        <p className="check-result__note" data-testid="other-sleeve">
          {CHECK_TEXT.otherSleeve}
        </p>
      )}

      <div className="check-result__actions">
        <button type="button" className="button button--primary" onClick={() => onTryOn(garment, size)}>
          {CHECK_TEXT.tryOn}
        </button>
        <a className="button button--ink-outline" href={product.productUrl} target="_blank" rel="noopener noreferrer">
          {CHECK_TEXT.openAt}
        </a>
      </div>
    </section>
  );
}

/**
 * Uniqlo's photo as it is: fitted into its frame (contained, never cropped or recoloured),
 * and only from Uniqlo's image host; the flat drawing without one or on an error.
 */
function ProductPhoto({ garment, url, name }: { garment: Garment; url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = uniqloPhoto(url);
  if (!src || failed) return <GarmentIcon garment={garment} />;
  return (
    <img
      className="check-result__photo"
      data-testid="check-photo"
      src={src}
      alt={`${name}, ${CHECK_TEXT.photoCredit}`}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
