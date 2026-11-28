import { useEffect, useMemo, useState } from 'react';
import { estimateBody, type BodyInput } from '@choudo/core/domain/body';
import { preferenceSpec, type Anchor, type FitStyle } from '@choudo/core/domain/fit';
import { findGarment, GARMENTS, publicGarments, type CatalogueScope, type Garment } from '@choudo/core/domain/garments';
import type { HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import { MascotHeadContext } from './ui/components/Mannequin/MascotHead';
import { useLinkCheck } from './links/useLinkCheck';
import { track, type TrackEvent } from './ui/analytics';
import { TabBar, type Tab } from './ui/components/TabBar';
import { DEV_TOOLS, devToolsOn } from './ui/devTools';
import { fitReferenceLine } from '@choudo/core/ui-logic/fitText';
import { AnchorScreen } from './ui/screens/AnchorScreen';
import { BodyScreen } from './ui/screens/BodyScreen';
import { Check } from './ui/screens/Check';
import { Closet } from './ui/screens/Closet';
import { Discover } from './ui/screens/Discover';
import { FittingRoom } from './ui/screens/FittingRoom';
import { nextOutfitName } from '@choudo/core/ui-logic/state/closet';
import { findFetched, RECENT_CHECKS, readyFetched, replaceFetched, withColor } from '@choudo/core/ui-logic/state/fetched';
import { wearGarment } from '@choudo/core/ui-logic/state/outfit';
import { useCloset } from './ui/state/useCloset';
import { usePersistentState } from './ui/state/usePersistentState';
import {
  EMPTY_OUTFIT,
  isAnchor,
  isBoolean,
  isCatalogueScope,
  isFetchedList,
  isFitStyle,
  isFitTestList,
  isHeadKind,
  isOutfit,
  isStoredBody,
  isStringList,
  isUnitSystem,
  STORAGE_KEYS,
  type FitTestRecord,
  type StoredFetched,
  type Outfit,
  type UnitSystem,
} from '@choudo/core/ui-logic/state/stored';

/**
 * Enter your body once, then check a product link's size, or move between the fitting
 * room, the Discover feed and your Closet. Everything the user enters is kept in this
 * browser's localStorage and never leaves the device: a pasted link's product code goes to
 * the fetch service (links/fetchUniqlo.ts) and on to Uniqlo, nothing else. The production
 * build only counts anonymous visits and the fixed steps in ui/analytics.ts.
 */
export function App() {
  // The mascot head is a drawing choice: every Mannequin reads it from the context.
  const [head, setHead] = usePersistentState<HeadKind>(STORAGE_KEYS.head, 'cloud', isHeadKind);
  return (
    <MascotHeadContext.Provider value={head}>
      <Screens head={head} onHeadChange={setHead} />
    </MascotHeadContext.Provider>
  );
}

/** The step counted when each tab is shown (none for Check, where the site opens: the page view counts it). */
const TAB_EVENTS: Partial<Record<Tab, TrackEvent>> = {
  fitting: 'fitting-room-opened',
  discover: 'discover-opened',
  closet: 'closet-opened',
};

function Screens({ head, onHeadChange }: { head: HeadKind; onHeadChange: (head: HeadKind) => void }) {
  const [body, setBody] = usePersistentState<BodyInput | null>(STORAGE_KEYS.body, null, isStoredBody);
  const [units, setUnits] = usePersistentState<UnitSystem>(STORAGE_KEYS.units, 'metric', isUnitSystem);
  const [outfit, setOutfit] = usePersistentState<Outfit>(STORAGE_KEYS.outfit, EMPTY_OUTFIT, isOutfit);
  const [anchor, setAnchor] = usePersistentState<Anchor | null>(STORAGE_KEYS.anchor, null, isAnchor);
  const [fitStyle, setFitStyle] = usePersistentState<FitStyle | null>(STORAGE_KEYS.fitStyle, null, isFitStyle);
  const preference = useMemo(() => preferenceSpec(anchor, fitStyle), [anchor, fitStyle]);
  const [catalogue, setCatalogue] = usePersistentState<CatalogueScope>(STORAGE_KEYS.catalogue, 'matching', isCatalogueScope);
  const [testMode, setTestMode] = usePersistentState<boolean>(STORAGE_KEYS.testMode, false, isBoolean);
  const [fitTests, setFitTests] = usePersistentState<FitTestRecord[]>(STORAGE_KEYS.fitTests, [], isFitTestList);
  const testing = devToolsOn(testMode, DEV_TOOLS);
  // The garments the app may show: sample rows only in development or Test mode, never on the public site.
  const includeSamples = DEV_TOOLS || testing;
  const garments = useMemo(() => publicGarments(GARMENTS, { includeSamples }), [includeSamples]);
  // Garments read from pasted links (the Check tab), newest first: also its 7-day cache.
  const [fetchedList, setFetchedList] = usePersistentState<StoredFetched[]>(STORAGE_KEYS.fetched, [], isFetchedList);
  const [unsupportedHosts, setUnsupportedHosts] = usePersistentState<string[]>(STORAGE_KEYS.unsupportedHosts, [], isStringList);
  // The one ready list (checked and normalised like seed rows; any that fail are dropped), built
  // here only, so every screen gets the same Garment objects. Still, compare garments by id.
  const fetched = useMemo(() => readyFetched(fetchedList), [fetchedList]);
  const fromLink = useMemo(() => new Set(fetched.map((f) => f.garment.id)), [fetched]);
  // The Fitting room and the Closet: garments from links first, then the catalogue.
  // Discover's feed stays the catalogue's (as on the phone).
  const withLinks = useMemo(
    () => [...fetched.map((f) => f.garment), ...garments.filter((g) => !fromLink.has(g.id))],
    [fetched, garments, fromLink],
  );
  const link = useLinkCheck(
    { list: fetchedList, setList: setFetchedList, hosts: unsupportedHosts, setHosts: setUnsupportedHosts },
    { onChecked: () => track('link-checked'), onUnsupported: () => track('link-unsupported') },
  );
  const model = useMemo(() => (body ? estimateBody(body) : null), [body]);
  const closet = useCloset();
  /** The main tabs, Edit body, or the fit-reference step (and where it goes back to). */
  const [screen, setScreen] = useState<'tabs' | 'body' | 'fit'>('tabs');
  const [fitReturn, setFitReturn] = useState<'tabs' | 'body'>('tabs');
  const [tab, setTab] = useState<Tab>('check');
  const onTabs = body !== null && screen === 'tabs';
  useEffect(() => {
    if (onTabs && TAB_EVENTS[tab]) track(TAB_EVENTS[tab]);
  }, [onTabs, tab]);
  // A new tab starts at its top (Try it on from far down the Check tab lands on the figure).
  useEffect(() => {
    if (onTabs) window.scrollTo(0, 0);
  }, [onTabs, tab]);

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

  if (!body || !model || screen === 'body') {
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
  // The result as the rest of the app has it (the one ready list), once it's stored; the check's own copy until then.
  const checkedId = link.state.kind === 'result' ? link.state.fetched.garment.id : null;
  const checked = checkedId ? fetched.find((f) => f.garment.id === checkedId) : undefined;

  return (
    <div className="app-shell">
      {tab === 'check' && (
        <Check
          model={model}
          preference={preference}
          units={units}
          hasFitReference={preference.source === 'anchor'}
          state={checked ? { kind: 'result', fetched: checked } : link.state}
          recent={fetched.slice(0, RECENT_CHECKS)}
          onCheck={link.check}
          onRetry={link.retry}
          onOpenRecent={link.showStored}
          onTryOn={tryOn}
          onEditBody={editBody}
          onColor={(garmentId, code) => {
            // Stored with the entry: the preview, the Fitting room and "Try it on" all draw it in this colour.
            const entry = findFetched(fetchedList, garmentId);
            if (entry) setFetchedList(replaceFetched(fetchedList, withColor(entry, code)));
          }}
          unsupportedHosts={testing ? unsupportedHosts : undefined}
        />
      )}
      {tab === 'fitting' && (
        <FittingRoom
          body={body}
          preference={preference}
          units={units}
          garments={withLinks}
          fromLink={fromLink}
          outfit={outfit}
          catalogue={catalogue}
          onCatalogueChange={setCatalogue}
          onOutfitChange={setOutfit}
          onSaveOutfit={closet.saveOutfit}
          nextOutfitName={nextOutfitName(closet.outfits)}
          onUnitsChange={setUnits}
          onEditBody={editBody}
          head={head}
          onHeadChange={onHeadChange}
          testing={
            testing
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
          garments={garments}
          showOdds={testing}
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
          garments={withLinks}
          showOdds={testing}
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
