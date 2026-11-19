import { useState } from 'react';
import type { BodyInput } from './domain/body';
import { preferenceSpec } from './domain/fit';
import type { Garment } from './domain/garments';
import { TabBar, type Tab } from './ui/components/TabBar';
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
  isOutfit,
  isStoredBody,
  isUnitSystem,
  STORAGE_KEYS,
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
  const closet = useCloset();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('fitting');

  if (!body || editing) {
    return (
      <BodyScreen
        initial={body}
        units={units}
        onDone={(input, u) => {
          setBody(input);
          setUnits(u);
          setEditing(false);
        }}
        onCancel={body ? () => setEditing(false) : undefined}
      />
    );
  }

  // Phase 3: replaced by the stored anchor / fit style.
  const preference = preferenceSpec(null, null);
  const editBody = () => setEditing(true);
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
          onOutfitChange={setOutfit}
          onSaveOutfit={closet.saveOutfit}
          nextOutfitName={nextOutfitName(closet.outfits)}
          onUnitsChange={setUnits}
          onEditBody={editBody}
        />
      )}
      {tab === 'discover' && (
        <Discover
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
