import { router, useIsFocused } from 'expo-router';
import { useContext } from 'react';

import { Button } from '@/components/button';
import { MascotHeadContext } from '@/components/mannequin/head-context';
import { useFitReference } from '@/hooks/use-fit-reference';
import { useFitTests } from '@/hooks/use-fit-tests';
import { useHead } from '@/hooks/use-head';
import { useTestMode } from '@/hooks/use-test-mode';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { FittingRoom } from '@/screens/fitting-room';
import { DEV_TOOLS } from '@/utils/dev-tools';
import { exportFitTests } from '@/utils/export-fit-tests';

export default function FittingRoomRoute() {
  const wardrobe = useWardrobe();
  const [, setHead] = useHead();
  // The root layout provides the stored head, so the whole app draws the same one.
  const head = useContext(MascotHeadContext);
  // Native tabs stay mounted: work the neighbours' odds out only while this tab is showing.
  const focused = useIsFocused();
  const [testMode] = useTestMode();
  const [fitTests, setFitTests] = useFitTests();
  const { anchor } = useFitReference();
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
      garments={wardrobe.garments}
      head={head}
      onHeadChange={setHead}
      onEditBody={() => router.push('/body')}
      onDetails={(garmentId, size) => router.push({ pathname: '/fit-details', params: { garmentId, size, from: 'fitting' } })}
      onSaveOutfit={() => router.push('/save-outfit')}
      prefetch={focused}
      testing={
        DEV_TOOLS && testMode
          ? {
              records: fitTests,
              anchor,
              onAdd: (record) => setFitTests([...fitTests, record]),
              onClear: () => setFitTests([]),
              onExport: () => void exportFitTests(fitTests).catch(() => {}),
            }
          : undefined
      }
      devTools={
        __DEV__ && <Button variant="quiet" size="sm" title="Mannequin lab" onPress={() => router.push('/dev/mannequin')} />
      }
    />
  );
}
