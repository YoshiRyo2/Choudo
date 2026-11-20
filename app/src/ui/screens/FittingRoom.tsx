import { useMemo, useRef, useState } from 'react';
import { estimateBody, type BodyInput } from '../../domain/body';
import { fitAllSizes, measurementHint, type Anchor, type GarmentFit, type GarmentOdds, type PreferenceSpec } from '../../domain/fit';
import { catalogueFor, findGarment, GARMENTS, type CatalogueScope, type Garment, type GarmentCategory } from '../../domain/garments';
import { catalogueToggle, emptyCategoryText } from '../catalogueText';
import { FitReadout } from '../components/FitReadout';
import { FitSheet } from '../components/FitSheet';
import { FitStrip } from '../components/FitStrip';
import { GarmentCarousel } from '../components/GarmentCarousel';
import { Mannequin, type WornGarment } from '../components/Mannequin/Mannequin';
import { NameForm } from '../components/NameForm';
import { SegmentedControl } from '../components/SegmentedControl';
import { Sheet } from '../components/Sheet';
import { Wordmark } from '../components/Wordmark';
import { makeId } from '../state/closet';
import { makeFitTest, predictionFor } from '../state/fitTests';
import { garmentOdds } from '../state/odds';
import { defaultSize, resolveOutfit } from '../state/outfit';
import type { FitTestRecord, Outfit, UnitSystem } from '../state/stored';
import { FitTestPanel } from './FitTestPanel';
import './FittingRoom.css';

interface FittingRoomProps {
  body: BodyInput;
  /** How the user likes tops to fit. */
  preference: PreferenceSpec;
  units: UnitSystem;
  /** The outfit on the mannequin, as stored (may be stale; it's resolved here). */
  outfit: Outfit;
  onOutfitChange: (outfit: Outfit) => void;
  /** Show garments for the user's body type (plus unisex), or all of them. */
  catalogue: CatalogueScope;
  onCatalogueChange: (scope: CatalogueScope) => void;
  /** Save what's on the mannequin to the Closet under a name. */
  onSaveOutfit: (outfit: Outfit, name: string) => void;
  /** Default name for the next saved outfit, e.g. "Outfit 3". */
  nextOutfitName: string;
  onUnitsChange: (units: UnitSystem) => void;
  onEditBody: () => void;
  /** Present when Test mode is on. */
  testing?: {
    records: FitTestRecord[];
    /** The stored anchor, so a result says what the prediction was compared with. */
    anchor: Anchor | null;
    onAdd: (record: FitTestRecord) => void;
    onClear: () => void;
  };
}

interface Slot {
  garment: Garment;
  size: string;
  fits: GarmentFit[];
  fit: GarmentFit;
  odds: GarmentOdds;
  recommended: string | null;
}

export function FittingRoom({
  body,
  preference,
  units,
  outfit: saved,
  onOutfitChange: setSaved,
  catalogue,
  onCatalogueChange,
  onSaveOutfit,
  nextOutfitName,
  onUnitsChange,
  onEditBody,
  testing,
}: FittingRoomProps) {
  const model = useMemo(() => estimateBody(body), [body]);
  const shown = useMemo(() => catalogueFor(GARMENTS, body.bodyType, catalogue), [body.bodyType, catalogue]);
  const outfit = useMemo(() => resolveOutfit(saved, model, preference, shown), [saved, model, preference, shown]);
  const [browsing, setBrowsing] = useState<GarmentCategory>('top');
  const [saving, setSaving] = useState<'naming' | 'saved' | null>(null);

  const slot = (id: string | null, size: string | null): Slot | null => {
    const garment = id ? findGarment(id) : undefined;
    if (!garment || !size) return null;
    const fits = fitAllSizes(model, garment);
    const odds = garmentOdds(model, garment, preference);
    return {
      garment,
      size,
      fits,
      fit: fits.find((f) => f.sizeLabel === size)!,
      odds,
      recommended: odds.recommended,
    };
  };
  // A handful of sizes per garment — cheap enough to recompute every render.
  const top = slot(outfit.topId, outfit.topSize);
  const bottom = slot(outfit.bottomId, outfit.bottomSize);

  const active = browsing === 'top' ? top : bottom;
  const [showDetails, setShowDetails] = useState(false);
  const activeGarment = active?.garment;
  const activeRecommended = active?.recommended ?? null;
  // Re-runs the sampler a few times, so only when the garment, body or preference changes.
  const hint = useMemo(
    () => (activeGarment ? measurementHint(model, activeGarment, preference, { current: activeRecommended }) : null),
    [model, activeGarment, preference, activeRecommended],
  );

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

  // The carousel: what's on show in this category, plus the worn garment if the filter hides it.
  const inCategory = shown.filter((g) => g.category === browsing);
  const carousel = active && !inCategory.includes(active.garment) ? [active.garment, ...inCategory] : inCategory;

  // The Show chip lives in the carousel, which remounts when the scope changes;
  // put focus back on the new chip so a keyboard user isn't dropped.
  const show = catalogueToggle(body.bodyType, catalogue);
  const refocusShow = useRef(false);

  const worn = (s: Slot | null): WornGarment | undefined =>
    s ? { garment: s.garment, sizeLabel: s.size, fit: s.fit } : undefined;

  return (
    <div className="fitting">
      <header className="fitting__bar">
        <Wordmark />
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
        <Mannequin body={model.measurements} top={worn(top)} bottom={worn(bottom)} frame="body" />
        <button type="button" className="fitting__save" aria-label="Save outfit" title="Save outfit" onClick={() => setSaving('naming')}>
          {/* A bookmark with a plus: keep this outfit. */}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1ZM12 7.5v6M9 10.5h6" />
          </svg>
        </button>
      </section>

      {active && (
        <section className="fitting__strip" aria-label="Size and fit">
          <FitStrip
            garment={active.garment}
            fits={active.fits}
            size={active.size}
            recommended={active.recommended}
            odds={active.odds}
            onSelectSize={chooseSize}
            onDetails={() => setShowDetails(true)}
          />
        </section>
      )}

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

        {carousel.length > 0 ? (
          <GarmentCarousel
            key={`${browsing}-${catalogue}`}
            label={browsing === 'top' ? 'Tops' : 'Bottoms'}
            garments={carousel}
            selectedId={active?.garment.id ?? null}
            onSelect={chooseGarment}
            headerAction={
              <button
                type="button"
                className="fitting__show"
                aria-label={show.accessibleName}
                ref={(el) => {
                  if (el && refocusShow.current) {
                    refocusShow.current = false;
                    el.focus();
                  }
                }}
                onClick={() => {
                  refocusShow.current = true;
                  onCatalogueChange(show.next);
                }}
              >
                {show.label}
              </button>
            }
          />
        ) : (
          <div className="fitting__empty">
            <p>{emptyCategoryText(body.bodyType, browsing)}</p>
            <button type="button" className="button button--outline button--small" onClick={() => onCatalogueChange('all')}>
              Show all
            </button>
          </div>
        )}

        {active && (
          <FitReadout
            garment={active.garment}
            fit={active.fit}
            units={units}
            odds={active.odds}
            preference={preference}
            hint={hint}
            summary={false}
            onEditBody={onEditBody}
          />
        )}

        {/* import.meta.env.DEV here, not only in App, so the build drops the panel's code. */}
        {import.meta.env.DEV && testing && (
          <FitTestPanel
            key={active ? `${active.garment.id}-${active.size}` : 'none'}
            garment={active ? active.garment : null}
            size={active ? active.size : null}
            fit={active ? active.fit : null}
            records={testing.records}
            onClear={testing.onClear}
            bodyType={body.bodyType}
            onSave={(answers) => {
              if (!active) return;
              const prediction = predictionFor({
                body,
                model,
                garment: active.garment,
                size: active.size,
                preference,
                anchor: testing.anchor,
                odds: active.odds,
              });
              testing.onAdd(makeFitTest(makeId(), new Date().toISOString(), active.garment.id, active.size, answers, prediction));
            }}
          />
        )}

        {showDetails && active && (
          <FitSheet
            key={`${active.garment.id}-${active.size}`}
            garment={active.garment}
            model={model}
            preference={preference}
            size={active.size}
            units={units}
            onClose={() => setShowDetails(false)}
            onTryOn={(size) => {
              chooseSize(size);
              setShowDetails(false);
            }}
            actionLabel={(size) => (size === active.size ? 'Done' : `Wear ${size}`)}
            onEditBody={onEditBody}
          />
        )}
      </section>
    </div>
  );
}
