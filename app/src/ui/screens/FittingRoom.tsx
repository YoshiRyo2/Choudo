import { useMemo, useState } from 'react';
import { estimateBody, type BodyInput } from '../../domain/body';
import { fitAllSizes, recommendSize, type GarmentFit } from '../../domain/fit';
import { findGarment, garmentsByCategory, type Garment, type GarmentCategory } from '../../domain/garments';
import { GarmentCarousel } from '../components/GarmentCarousel';
import { Mannequin, type WornGarment } from '../components/Mannequin/Mannequin';
import { SegmentedControl } from '../components/SegmentedControl';
import { SizePicker } from '../components/SizePicker';
import { defaultSize, resolveOutfit } from '../state/outfit';
import { EMPTY_OUTFIT, isOutfit, STORAGE_KEYS, type Outfit, type UnitSystem } from '../state/stored';
import { usePersistentState } from '../state/usePersistentState';
import './FittingRoom.css';

interface FittingRoomProps {
  body: BodyInput;
  units: UnitSystem;
  onUnitsChange: (units: UnitSystem) => void;
  onEditBody: () => void;
}

const TOPS = garmentsByCategory('top');
const BOTTOMS = garmentsByCategory('bottom');

interface Slot {
  garment: Garment;
  size: string;
  fits: GarmentFit[];
  fit: GarmentFit;
  recommended: string | null;
}

export function FittingRoom({ body, units, onUnitsChange, onEditBody }: FittingRoomProps) {
  const model = useMemo(() => estimateBody(body), [body]);
  const [saved, setSaved] = usePersistentState<Outfit>(STORAGE_KEYS.outfit, EMPTY_OUTFIT, isOutfit);
  const outfit = useMemo(() => resolveOutfit(saved, model), [saved, model]);
  const [browsing, setBrowsing] = useState<GarmentCategory>('top');

  const slot = (id: string | null, size: string | null): Slot | null => {
    const garment = id ? findGarment(id) : undefined;
    if (!garment || !size) return null;
    const fits = fitAllSizes(model, garment);
    return {
      garment,
      size,
      fits,
      fit: fits.find((f) => f.sizeLabel === size)!,
      recommended: recommendSize(model, garment),
    };
  };
  // A handful of sizes per garment — cheap enough to recompute every render.
  const top = slot(outfit.topId, outfit.topSize);
  const bottom = slot(outfit.bottomId, outfit.bottomSize);

  const active = browsing === 'top' ? top : bottom;

  function chooseGarment(id: string) {
    const garment = findGarment(id);
    if (!garment) return;
    const size = defaultSize(model, garment);
    setSaved(
      garment.category === 'top'
        ? { ...outfit, topId: id, topSize: size }
        : { ...outfit, bottomId: id, bottomSize: size },
    );
  }

  function chooseSize(size: string) {
    setSaved(browsing === 'top' ? { ...outfit, topSize: size } : { ...outfit, bottomSize: size });
  }

  const worn = (s: Slot | null): WornGarment | undefined =>
    s ? { garment: s.garment, sizeLabel: s.size, fit: s.fit } : undefined;

  return (
    <div className="fitting">
      <header className="fitting__bar">
        <p className="wordmark">Nimbus</p>
        <SegmentedControl
          label="Units"
          hideLabel
          value={units}
          options={[
            { value: 'metric', label: 'cm' },
            { value: 'imperial', label: 'in' },
          ]}
          onChange={onUnitsChange}
        />
        <button type="button" className="button button--quiet fitting__edit" onClick={onEditBody}>
          Edit body
        </button>
      </header>

      <section className="fitting__stage" aria-label="Mannequin">
        <Mannequin body={model.measurements} top={worn(top)} bottom={worn(bottom)} />
      </section>

      <section className="fitting__panel" aria-label="Choose clothes">
        <SegmentedControl
          label="Browsing"
          hideLabel
          value={browsing}
          options={[
            { value: 'top', label: top ? `Top: ${top.garment.name}` : 'Tops' },
            { value: 'bottom', label: bottom ? `Bottom: ${bottom.garment.name}` : 'Bottoms' },
          ]}
          onChange={setBrowsing}
        />

        <GarmentCarousel
          key={browsing}
          label={browsing === 'top' ? 'Tops' : 'Bottoms'}
          garments={browsing === 'top' ? TOPS : BOTTOMS}
          selectedId={active?.garment.id ?? null}
          onSelect={chooseGarment}
        />

        {active && (
          <SizePicker
            fits={active.fits}
            selected={active.size}
            recommended={active.recommended}
            onSelect={chooseSize}
          />
        )}
      </section>
    </div>
  );
}
