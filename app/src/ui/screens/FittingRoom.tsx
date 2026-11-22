import { useEffect, useMemo, useRef, useState } from 'react';
import { estimateBody, type BodyInput } from '../../domain/body';
import {
  fitAllSizes,
  type Anchor,
  type GarmentFit,
  type GarmentOdds,
  type PreferenceSpec,
  type UnderLayer,
} from '../../domain/fit';
import { catalogueFor, findGarment, GARMENTS, type CatalogueScope, type Garment, type GarmentCategory } from '../../domain/garments';
import { catalogueToggle, emptyCategoryText } from '../catalogueText';
import { FitAnswer } from '../components/FitAnswer';
import { FitSheet } from '../components/FitSheet';
import { GarmentCarousel } from '../components/GarmentCarousel';
import { HEAD_KINDS, HEAD_NAME, type HeadKind } from '../components/Mannequin/heads';
import { MascotHeadIcon } from '../components/Mannequin/MascotHead';
import { Mannequin, type WornGarment } from '../components/Mannequin/Mannequin';
import type { View } from '../components/Mannequin/view';
import { NameForm } from '../components/NameForm';
import { SegmentedControl } from '../components/SegmentedControl';
import { Sheet } from '../components/Sheet';
import { SizePicker } from '../components/SizePicker';
import { Stamp } from '../components/Stamp/Stamp';
import { useStampDrop } from '../components/Stamp/useStampDrop';
import { Wordmark } from '../components/Wordmark';
import { fittingHeadline, isJustRight } from '../fitText';
import { clickedByPointer, refocus } from '../focus';
import { hop } from '../motion';
import { makeId } from '../state/closet';
import { makeFitTest, predictionFor } from '../state/fitTests';
import { garmentOdds } from '../state/odds';
import { stampKey } from '../state/stampSeen';
import { defaultSize, resolveOutfit, wearGarment } from '../state/outfit';
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
  /** The mascot head (a drawing choice, stored by App) and the picker's change. */
  head: HeadKind;
  onHeadChange: (head: HeadKind) => void;
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

const CAROUSEL_LABEL: Record<GarmentCategory, string> = { top: 'Tops', bottom: 'Bottoms', onepiece: 'Dresses', outer: 'Jackets' };

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
  head,
  onHeadChange,
  testing,
}: FittingRoomProps) {
  const model = useMemo(() => estimateBody(body), [body]);
  const shown = useMemo(() => catalogueFor(GARMENTS, body.bodyType, catalogue), [body.bodyType, catalogue]);
  const outfit = useMemo(() => resolveOutfit(saved, model, preference, shown), [saved, model, preference, shown]);
  // Open on the dress when one is worn: the Top tab would have nothing on to show.
  const [browsing, setBrowsing] = useState<GarmentCategory>(() => (outfit.onepieceId ? 'onepiece' : 'top'));
  const [saving, setSaving] = useState<'naming' | 'saved' | null>(null);
  // Which side of the mannequin is shown; a drawing choice only, not stored.
  const [view, setView] = useState<View>('front');

  const slot = (id: string | null, size: string | null, under?: UnderLayer): Slot | null => {
    const garment = id ? findGarment(id) : undefined;
    if (!garment || !size) return null;
    const fits = fitAllSizes(model, garment, under);
    const odds = garmentOdds(model, garment, preference, under);
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
  const onepiece = slot(outfit.onepieceId, outfit.onepieceSize);
  // A jacket is fitted over the top (or the dress) under it (domain/fit/layers.ts); its size cards elsewhere stay bare-body.
  // Memoized on that garment and its size, so screens that memo on it (the fit sheet's hint) don't re-sample every render.
  const topGarment = (top ?? onepiece)?.garment;
  const topSize = (top ?? onepiece)?.size;
  const under = useMemo<UnderLayer | undefined>(
    () => (topGarment && topSize ? { garment: topGarment, sizeLabel: topSize } : undefined),
    [topGarment, topSize],
  );
  const outer = slot(outfit.outerId, outfit.outerSize, under);

  // The Dress tab shows when there's a dress on show or one is worn (none for a men's body on its own sizing).
  const hasDresses = onepiece !== null || shown.some((g) => g.category === 'onepiece');
  const tab: GarmentCategory = browsing === 'onepiece' && !hasDresses ? 'top' : browsing;
  const active = { top, bottom, outer, onepiece }[tab];
  const activeUnder = tab === 'outer' ? under : undefined;
  // The zones, tape scales, cm and odds live in this sheet: the screen itself shows no numbers.
  const [showDetails, setShowDetails] = useState(false);

  // The face follows the shown size's verdict tone; the ちょうど stamp shows when it is
  // the suggested size and the headline says it fits, and drops once per garment + size.
  const face = active ? fittingHeadline(active.odds, active.size, active.garment).tone : 'unknown';
  const stamp = active && isJustRight(active.odds, active.size, active.garment) ? stampKey(active.garment.id, active.size) : null;
  const dropping = useStampDrop(stamp);
  const figure = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (dropping) hop(figure.current);
  }, [dropping, stamp]);

  function chooseGarment(id: string) {
    const garment = findGarment(id);
    if (!garment) return;
    // A jacket starts in the size suggested over the top it goes on.
    const overTop = garment.category === 'outer' ? garmentOdds(model, garment, preference, under).recommended : null;
    setSaved(wearGarment(outfit, garment, overTop ?? defaultSize(model, garment, preference)));
  }

  function chooseSize(size: string) {
    if (tab === 'top') setSaved({ ...outfit, topSize: size });
    else if (tab === 'bottom') setSaved({ ...outfit, bottomSize: size });
    else if (tab === 'onepiece') setSaved({ ...outfit, onepieceSize: size });
    else setSaved({ ...outfit, outerSize: size });
  }

  const takeOffJacket = () => setSaved({ ...outfit, outerId: null, outerSize: null });

  // The carousel: what's on show in this category, plus the worn garment if the filter hides it.
  const inCategory = shown.filter((g) => g.category === tab);
  const carousel = active && !inCategory.includes(active.garment) ? [active.garment, ...inCategory] : inCategory;

  // The Show chip lives in the carousel, which remounts when the scope changes;
  // put focus back on the new chip so a keyboard user isn't dropped.
  const show = catalogueToggle(body.bodyType, catalogue);
  // null: leave focus alone; otherwise how the chip was activated.
  const refocusShow = useRef<null | 'pointer' | 'keyboard'>(null);

  const worn = (s: Slot | null): WornGarment | undefined =>
    s ? { garment: s.garment, sizeLabel: s.size, fit: s.fit } : undefined;

  return (
    <main className="fitting">
      <h1 className="visually-hidden">Fitting room</h1>
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

      <div className="fitting__garment">
        {active ? (
          <div className="fitting__garment-name">
            <p className="fitting__name">{active.garment.name}</p>
            <p className="fitting__brand">{active.garment.brand}</p>
          </div>
        ) : (
          <span />
        )}
        <SegmentedControl
          label="View"
          hideLabel
          value={view}
          options={[
            { value: 'front', label: 'Front' },
            { value: 'back', label: 'Back' },
          ]}
          onChange={setView}
        />
      </div>

      {active && (
        <section className="fitting__answer" aria-label="Fit">
          <FitAnswer garment={active.garment} size={active.size} odds={active.odds} />
        </section>
      )}

      <section className="fitting__stage" aria-label="Mannequin">
        <div className="fitting__circle" aria-hidden="true" />
        {/* The hop moves this wrapper (translate only), so the SVG and its photos aren't redrawn. */}
        <div className="fitting__figure" ref={figure}>
          <Mannequin
            body={model.measurements}
            top={worn(top)}
            bottom={worn(bottom)}
            onepiece={worn(onepiece)}
            outer={worn(outer)}
            frame="body"
            view={view}
            showHeightTape={false}
            head={head}
            face={face}
          />
        </div>
        <div className="fitting__heads" role="group" aria-label="Head">
          {HEAD_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="fitting__head"
              aria-label={`${HEAD_NAME[kind]} head`}
              aria-pressed={head === kind}
              onClick={() => onHeadChange(kind)}
            >
              <MascotHeadIcon kind={kind} />
            </button>
          ))}
        </div>
        {stamp && <Stamp key={stamp} dropping={dropping} className="fitting__stamp" />}
        <button type="button" className="fitting__save" aria-label="Save outfit" title="Save outfit" onClick={() => setSaving('naming')}>
          {/* A bookmark with a plus: keep this outfit. */}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1ZM12 7.5v6M9 10.5h6" />
          </svg>
        </button>
      </section>

      {active && (
        <section className="fitting__sizes" aria-label="Size">
          <SizePicker
            key={active.garment.id}
            layout="row"
            fits={active.fits}
            selected={active.size}
            recommended={active.recommended}
            odds={active.odds}
            onSelect={chooseSize}
          />
          <button type="button" className="button button--ink-outline fitting__details" onClick={() => setShowDetails(true)}>
            See fit details
          </button>
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
          value={tab}
          options={[
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            ...(hasDresses ? [{ value: 'onepiece' as const, label: 'Dress' }] : []),
            { value: 'outer', label: 'Jacket' },
          ]}
          onChange={setBrowsing}
        />

        {carousel.length > 0 ? (
          <GarmentCarousel
            key={`${tab}-${catalogue}`}
            label={CAROUSEL_LABEL[tab]}
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
                    refocus(el, refocusShow.current === 'pointer');
                    refocusShow.current = null;
                  }
                }}
                onClick={(e) => {
                  refocusShow.current = clickedByPointer(e) ? 'pointer' : 'keyboard';
                  onCatalogueChange(show.next);
                }}
              >
                {show.label}
              </button>
            }
          />
        ) : (
          <div className="fitting__empty">
            <p>{emptyCategoryText(body.bodyType, tab)}</p>
            <button type="button" className="button button--outline button--small" onClick={() => onCatalogueChange('all')}>
              Show all
            </button>
          </div>
        )}

        {tab === 'outer' && outer && (
          <button type="button" className="button button--outline button--small fitting__take-off" onClick={takeOffJacket}>
            Take off the jacket
          </button>
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
                under: activeUnder,
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
            under={activeUnder}
          />
        )}
      </section>
    </main>
  );
}
