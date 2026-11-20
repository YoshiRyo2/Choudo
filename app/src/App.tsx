import { useMemo, useState } from 'react';
import type { BodyInput } from './domain/body';
import { preferenceSpec, type Anchor, type FitStyle } from './domain/fit';
import { findGarment, type CatalogueScope, type Garment } from './domain/garments';
import { TabBar, type Tab } from './ui/components/TabBar';
import { DEV_TOOLS, devToolsOn } from './ui/devTools';
import { fitReferenceLine } from './ui/fitText';
import { AnchorScreen } from './ui/screens/AnchorScreen';
import { BodyScreen } from './ui/screens/BodyScreen';
import { Closet } from './ui/screens/Closet';
import { Discover } from './ui/screens/Discover';
import { FittingRoom } from './ui/screens/FittingRoom';
import { nextOutfitName } from './ui/state/closet';
import { wearGarment } from './ui/state/outfit';
import { useCloset } from './ui/state/useCloset';
import { usePersistentState } from './ui/state/usePersistentState';
import {
  EMPTY_OUTFIT,
  isAnchor,
  isBoolean,
  isCatalogueScope,
  isFitStyle,
  isFitTestList,
  isOutfit,
  isStoredBody,
  isUnitSystem,
  STORAGE_KEYS,
  type FitTestRecord,
  type Outfit,
  type UnitSystem,
} from './ui/state/stored';

/**
 * Enter your body once, then move between the fitting room, the Discover feed
 * and your Closet. Everything the user enters is kept in this browser's
 * localStorage — nothing leaves the device.
 */
export function App() {
  const [body, setBody] = usePersistentState<BodyInput | null>(STORAGE_KEYS.body, null, isStoredBody);
  const [units, setUnits] = usePersistentState<UnitSystem>(STORAGE_KEYS.units, 'metric', isUnitSystem);
  const [outfit, setOutfit] = usePersistentState<Outfit>(STORAGE_KEYS.outfit, EMPTY_OUTFIT, isOutfit);
  const [anchor, setAnchor] = usePersistentState<Anchor | null>(STORAGE_KEYS.anchor, null, isAnchor);
  const [fitStyle, setFitStyle] = usePersistentState<FitStyle | null>(STORAGE_KEYS.fitStyle, null, isFitStyle);
  const preference = useMemo(() => preferenceSpec(anchor, fitStyle), [anchor, fitStyle]);
  const [catalogue, setCatalogue] = usePersistentState<CatalogueScope>(STORAGE_KEYS.catalogue, 'matching', isCatalogueScope);
  const [testMode, setTestMode] = usePersistentState<boolean>(STORAGE_KEYS.testMode, false, isBoolean);
  const [fitTests, setFitTests] = usePersistentState<FitTestRecord[]>(STORAGE_KEYS.fitTests, [], isFitTestList);
  const closet = useCloset();
  /** The main tabs, Edit body, or the fit-reference step (and where it goes back to). */
  const [screen, setScreen] = useState<'tabs' | 'body' | 'fit'>('tabs');
  const [fitReturn, setFitReturn] = useState<'tabs' | 'body'>('tabs');
  const [tab, setTab] = useState<Tab>('fitting');

  if (body && screen === 'fit') {
    return (
      <AnchorScreen
        units={units}
        anchor={anchor}
        style={fitStyle}
        skipLabel={fitReturn === 'tabs' ? 'Skip for now' : 'Cancel'}
        onDone={(a, s) => {
          setAnchor(a);
          setFitStyle(s);
          setScreen(fitReturn);
        }}
        onSkip={() => setScreen(fitReturn)}
      />
    );
  }

  if (!body || screen === 'body') {
    const firstTime = !body;
    return (
      <BodyScreen
        initial={body}
        units={units}
        onDone={(input, u) => {
          setBody(input);
          setUnits(u);
          // First time through, offer the fit-reference step once.
          if (firstTime && !anchor && !fitStyle) {
            setFitReturn('tabs');
            setScreen('fit');
          } else {
            setScreen('tabs');
          }
        }}
        onCancel={body ? () => setScreen('tabs') : undefined}
        testMode={body && DEV_TOOLS ? { on: testMode, onChange: setTestMode } : undefined}
        fitReference={
          body
            ? {
                line: fitReferenceLine(anchor, fitStyle, units, findGarment),
                isSet: anchor !== null || fitStyle !== null,
                onChange: (input, u) => {
                  // Keep what was typed on the body form before leaving it.
                  if (input) {
                    setBody(input);
                    setUnits(u);
                  }
                  setFitReturn('body');
                  setScreen('fit');
                },
                onRemove: () => {
                  setAnchor(null);
                  setFitStyle(null);
                },
              }
            : undefined
        }
      />
    );
  }

  const editBody = () => setScreen('body');
  /** Put an outfit on the mannequin and go and look at it. */
  const wear = (next: Outfit) => {
    setOutfit(next);
    setTab('fitting');
  };
  const tryOn = (garment: Garment, size: string) => wear(wearGarment(outfit, garment, size));

  return (
    <div className="app-shell">
      {tab === 'fitting' && (
        <FittingRoom
          body={body}
          preference={preference}
          units={units}
          outfit={outfit}
          catalogue={catalogue}
          onCatalogueChange={setCatalogue}
          onOutfitChange={setOutfit}
          onSaveOutfit={closet.saveOutfit}
          nextOutfitName={nextOutfitName(closet.outfits)}
          onUnitsChange={setUnits}
          onEditBody={editBody}
          testing={
            devToolsOn(testMode, DEV_TOOLS)
              ? {
                  records: fitTests,
                  anchor,
                  onAdd: (record) => setFitTests([...fitTests, record]),
                  onClear: () => setFitTests([]),
                }
              : undefined
          }
        />
      )}
      {tab === 'discover' && (
        <Discover
          // A new scope starts a new feed (the feed is fixed while the screen is open).
          key={catalogue}
          catalogue={catalogue}
          onCatalogueChange={setCatalogue}
          body={body}
          preference={preference}
          units={units}
          closet={closet}
          onTryOn={tryOn}
          onEditBody={editBody}
          onOpenCloset={() => setTab('closet')}
        />
      )}
      {tab === 'closet' && (
        <Closet
          body={body}
          preference={preference}
          units={units}
          closet={closet}
          outfit={outfit}
          onTryOn={tryOn}
          onWear={wear}
          onEditBody={editBody}
          onOpenDiscover={() => setTab('discover')}
        />
      )}
      <TabBar current={tab} onChange={setTab} />
    </div>
  );
}
