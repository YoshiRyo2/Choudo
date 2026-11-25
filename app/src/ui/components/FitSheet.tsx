import { useEffect, useMemo, useState } from 'react';
import type { BodyModel } from '@choudo/core/domain/body';
import { fitAllSizes, measurementHint, type PreferenceSpec, type UnderLayer } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import { layerNoteLines } from '@choudo/core/ui-logic/fitText';
import { track } from '../analytics';
import { FitReadout } from './FitReadout';
import { Sheet } from './Sheet';
import { SizePicker } from './SizePicker';

interface FitSheetProps {
  garment: Garment;
  model: BodyModel;
  preference: PreferenceSpec;
  /** The size to open on. */
  size: string;
  units: UnitSystem;
  onClose: () => void;
  onTryOn: (size: string) => void;
  /** The button text for onTryOn; defaults to "Try M in the fitting room". */
  actionLabel?: (size: string) => string;
  onEditBody: () => void;
  /** Worn under this garment (the fitting room's top under a jacket): fit and odds over it. */
  under?: UnderLayer;
}

const tryInFittingRoom = (size: string) => `Try ${size} in the fitting room`;

/** A garment's full fit, zone by zone with the chance of each label, a size picker and a way to try it on. */
export function FitSheet({
  garment,
  model,
  preference,
  size: initialSize,
  units,
  onClose,
  onTryOn,
  actionLabel = tryInFittingRoom,
  onEditBody,
  under,
}: FitSheetProps) {
  const [size, setSize] = useState(initialSize);
  useEffect(() => track('fit-details-opened'), []);
  const fits = useMemo(() => fitAllSizes(model, garment, under), [model, garment, under]);
  const odds = useMemo(() => garmentOdds(model, garment, preference, under), [model, garment, preference, under]);
  const hint = useMemo(
    () => measurementHint(model, garment, preference, { current: odds.recommended, under }),
    [model, garment, preference, odds, under],
  );
  const fit = fits.find((f) => f.sizeLabel === size) ?? fits[0]!;

  return (
    <Sheet title={garment.name} kicker={garment.brand} onClose={onClose}>
      <SizePicker fits={fits} selected={size} recommended={odds.recommended} odds={odds} onSelect={setSize} />
      <FitReadout
        garment={garment}
        fit={fit}
        units={units}
        odds={odds}
        preference={preference}
        hint={hint}
        showOdds
        layerNotes={layerNoteLines(model, under, { garment, sizeLabel: size }, units)}
        onEditBody={onEditBody}
      />
      <p className="sheet__note">
        Chances come from {odds.samples} tries with your measurements, the garment’s and your taste each nudged within
        how sure we are of them.
      </p>
      <div className="sheet__actions">
        <button type="button" className="button button--primary" onClick={() => onTryOn(size)}>
          {actionLabel(size)}
        </button>
      </div>
    </Sheet>
  );
}
