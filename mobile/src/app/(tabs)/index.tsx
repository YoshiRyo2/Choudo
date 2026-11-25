import { router, useIsFocused } from 'expo-router';
import { useContext } from 'react';

import { Button } from '@/components/button';
import { MascotHeadContext } from '@/components/mannequin/head-context';
import { useHead } from '@/hooks/use-head';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { FittingRoom } from '@/screens/fitting-room';

export default function FittingRoomRoute() {
  const wardrobe = useWardrobe();
  const [, setHead] = useHead();
  // The root layout provides the stored head, so the whole app draws the same one.
  const head = useContext(MascotHeadContext);
  // Native tabs stay mounted: work the neighbours' odds out only while this tab is showing.
  const focused = useIsFocused();
  if (!wardrobe) return null;
  return (
    <FittingRoom
      body={wardrobe.body}
      model={wardrobe.model}
      preference={wardrobe.preference}
      units={wardrobe.units}
      onUnitsChange={wardrobe.setUnits}
      outfit={wardrobe.outfit}
      onOutfitChange={wardrobe.setOutfit}
      catalogue={wardrobe.catalogue}
      onCatalogueChange={wardrobe.setCatalogue}
      shown={wardrobe.shown}
      head={head}
      onHeadChange={setHead}
      onEditBody={() => router.push('/body')}
      onDetails={(garmentId, size) => router.push({ pathname: '/fit-details', params: { garmentId, size, from: 'fitting' } })}
      onSaveOutfit={() => router.push('/save-outfit')}
      prefetch={focused}
      devTools={
        __DEV__ && <Button variant="quiet" size="sm" title="Mannequin lab" onPress={() => router.push('/dev/mannequin')} />
      }
    />
  );
}
