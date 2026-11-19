import { useEffect, useMemo, useRef, useState } from 'react';
import type { BodyModel } from '../../domain/body';
import { fitAllSizes, recommendSize } from '../../domain/fit';
import type { Garment } from '../../domain/garments';
import type { UnitSystem } from '../state/stored';
import { FitReadout } from './FitReadout';
import { SizePicker } from './SizePicker';
import './FitSheet.css';

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

/**
 * A garment's full fit, zone by zone, over the current screen. Built on
 * <dialog> so focus stays inside and Escape closes it.
 */
export function FitSheet({ garment, model, size: initialSize, units, onClose, onTryOn, onEditBody }: FitSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState(initialSize);
  const fits = useMemo(() => fitAllSizes(model, garment), [model, garment]);
  const recommended = useMemo(() => recommendSize(model, garment), [model, garment]);
  const fit = fits.find((f) => f.sizeLabel === size) ?? fits[0]!;

  // Unmounting removes it from the top layer, so no close() on cleanup (which
  // would fire onClose and, under StrictMode's double effects, shut it at once).
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => {
        // A tap on the dimmed backdrop (the dialog box itself, outside the panel) closes it.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet__panel">
        <header className="sheet__head">
          <div>
            <p className="sheet__brand">{garment.brand}</p>
            <h2 id="sheet-title" className="sheet__name">
              {garment.name}
            </h2>
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close fit details">
            ×
          </button>
        </header>
        <SizePicker fits={fits} selected={size} recommended={recommended} onSelect={setSize} />
        <FitReadout garment={garment} fit={fit} units={units} onEditBody={onEditBody} />
        <div className="sheet__actions">
          <button type="button" className="button button--primary" onClick={() => onTryOn(size)}>
            Try {size} in the fitting room
          </button>
        </div>
      </div>
    </dialog>
  );
}
