import { useMemo, useState } from 'react';
import type { BodyModel } from '../../domain/body';
import { fitAllSizes, recommendSize } from '../../domain/fit';
import type { Garment } from '../../domain/garments';
import type { UnitSystem } from '../state/stored';
import { FitReadout } from './FitReadout';
import { Sheet } from './Sheet';
import { SizePicker } from './SizePicker';

interface FitSheetProps {
  garment: Garment;
  model: BodyModel;
  /** The size to open on. */
  size: string;
  units: UnitSystem;
  onClose: () => void;
  onTryOn: (size: string) => void;
  onEditBody: () => void;
}

/** A garment's full fit, zone by zone, with a size picker and a way to try it on. */
export function FitSheet({ garment, model, size: initialSize, units, onClose, onTryOn, onEditBody }: FitSheetProps) {
  const [size, setSize] = useState(initialSize);
  const fits = useMemo(() => fitAllSizes(model, garment), [model, garment]);
  const recommended = useMemo(() => recommendSize(model, garment), [model, garment]);
  const fit = fits.find((f) => f.sizeLabel === size) ?? fits[0]!;

  return (
    <Sheet title={garment.name} kicker={garment.brand} onClose={onClose}>
      <SizePicker fits={fits} selected={size} recommended={recommended} onSelect={setSize} />
      <FitReadout garment={garment} fit={fit} units={units} onEditBody={onEditBody} />
      <div className="sheet__actions">
        <button type="button" className="button button--primary" onClick={() => onTryOn(size)}>
          Try {size} in the fitting room
        </button>
      </div>
    </Sheet>
  );
}
