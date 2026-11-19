import { useMemo, useState } from 'react';
import { estimateBody, type BodyInput } from '../../domain/body';
import { fitAllSizes, type GarmentFit, type PreferenceSpec } from '../../domain/fit';
import { findGarment, garmentsByCategory, type Garment, type GarmentCategory } from '../../domain/garments';
import { FitReadout } from '../components/FitReadout';
import { GarmentCarousel } from '../components/GarmentCarousel';
import { Mannequin, type WornGarment } from '../components/Mannequin/Mannequin';
import { NameForm } from '../components/NameForm';
import { SegmentedControl } from '../components/SegmentedControl';
import { Sheet } from '../components/Sheet';
import { SizePicker } from '../components/SizePicker';
import { garmentOdds } from '../state/odds';
import { defaultSize, resolveOutfit } from '../state/outfit';
import type { Outfit, UnitSystem } from '../state/stored';
import './FittingRoom.css';

interface FittingRoomProps {
  body: BodyInput;
  /** How the user likes tops to fit. */
  preference: PreferenceSpec;
  units: UnitSystem;
  /** The outfit on the mannequin, as stored (may be stale; it's resolved here). */
  outfit: Outfit;
  onOutfitChange: (outfit: Outfit) => void;
  /** Save what's on the mannequin to the Closet under a name. */
  onSaveOutfit: (outfit: Outfit, name: string) => void;
  /** Default name for the next saved outfit, e.g. "Outfit 3". */
  nextOutfitName: string;
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

export function FittingRoom({
  body,
  preference,
  units,
  outfit: saved,
  onOutfitChange: setSaved,
  onSaveOutfit,
  nextOutfitName,
  onUnitsChange,
  onEditBody,
}: FittingRoomProps) {
  const model = useMemo(() => estimateBody(body), [body]);
  const outfit = useMemo(() => resolveOutfit(saved, model, preference), [saved, model, preference]);
  const [browsing, setBrowsing] = useState<GarmentCategory>('top');
  const [saving, setSaving] = useState<'naming' | 'saved' | null>(null);

  const slot = (id: string | null, size: string | null): Slot | null => {
    const garment = id ? findGarment(id) : undefined;
    if (!garment || !size) return null;
    const fits = fitAllSizes(model, garment);
    return {
      garment,
      size,
      fits,
      fit: fits.find((f) => f.sizeLabel === size)!,
      recommended: garmentOdds(model, garment, preference).recommended,
    };
  };
  // A handful of sizes per garment — cheap enough to recompute every render.
  const top = slot(outfit.topId, outfit.topSize);
  const bottom = slot(outfit.bottomId, outfit.bottomSize);

  const active = browsing === 'top' ? top : bottom;

  function chooseGarment(id: string) {
    const garment = findGarment(id);
    if (!garment) return;
    const size = defaultSize(model, garment, preference);
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
        <button type="button" className="button button--outline button--small fitting__save" onClick={() => setSaving('naming')}>
          Save outfit
        </button>
      </section>

      {saving && (
        <Sheet title={saving === 'saved' ? 'Saved to your Closet' : 'Save this outfit'} onClose={() => setSaving(null)}>
          {saving === 'naming' ? (
            <NameForm
              label="Name"
              submitLabel="Save"
              placeholder={nextOutfitName}
              allowBlank
              autoFocus
              onSubmit={(name) => {
                onSaveOutfit(outfit, name);
                setSaving('saved');
              }}
            />
          ) : (
            <p className="fitting__saved">Find it under Closet → Outfits.</p>
          )}
        </Sheet>
      )}

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
          <>
            <SizePicker
              fits={active.fits}
              selected={active.size}
              recommended={active.recommended}
              onSelect={chooseSize}
            />
            <FitReadout garment={active.garment} fit={active.fit} units={units} onEditBody={onEditBody} />
          </>
        )}
      </section>
    </div>
  );
}
