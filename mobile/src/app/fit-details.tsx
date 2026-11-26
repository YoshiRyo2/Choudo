import { Redirect, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo } from 'react';
import type { UnderLayer } from '@choudo/core/domain/fit';
import { wearGarment } from '@choudo/core/ui-logic/state/outfit';

import { useFindGarment } from '@/hooks/use-fetched';
import { useTestMode } from '@/hooks/use-test-mode';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { DEV_TOOLS } from '@/utils/dev-tools';
import { FitDetails } from '@/screens/fit-details';

/** Leave the sheet for whatever is under it (the Fitting room on a cold start). */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/fitting-room');
}

/**
 * Fit details, a form sheet: `?garmentId=&size=&from=fitting|browse`. From the Fitting
 * room the button wears the size picked ("Done" for the one worn) and closes; from
 * browsing (Discover, the Closet) it puts the garment on and goes to the Fitting room.
 */
export default function FitDetailsRoute() {
  const params = useLocalSearchParams<{ garmentId?: string; size?: string; from?: string }>();
  const wardrobe = useWardrobe();
  const [testMode] = useTestMode();
  const findGarment = useFindGarment();
  const garment = params.garmentId ? findGarment(params.garmentId) : undefined;
  // What a worn jacket goes over, kept the same object while that garment and size stay
  // (as the web Fitting room's memo): the sheet memoises its sampling hint on it.
  const outfit = wardrobe?.outfit;
  const underId = outfit ? (outfit.topId ?? outfit.onepieceId) : null;
  const underSize = outfit ? (outfit.topId ? outfit.topSize : outfit.onepieceSize) : null;
  const worn = useMemo<UnderLayer | undefined>(() => {
    const g = underId ? findGarment(underId) : undefined;
    return g && underSize ? { garment: g, sizeLabel: underSize } : undefined;
  }, [underId, underSize, findGarment]);
  const missing = !wardrobe || !garment;
  // A garment we don't have (a stale link): close at once. The screen's own navigation, as
  // the imperative router isn't bound until after the first render.
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  useEffect(() => {
    if (missing && canGoBack) navigation.goBack();
  }, [missing, canGoBack, navigation]);
  if (missing) return canGoBack ? null : <Redirect href="/" />;

  const { model, preference, units, setOutfit } = wardrobe;
  const fromFitting = params.from !== 'browse';
  const size = garment.sizes.some((s) => s.label === params.size) ? params.size! : garment.sizes[0]!.label;
  // As the web Fitting room's activeUnder: the jacket on the mannequin is fitted over what's under it.
  const under = fromFitting && garment.category === 'outer' && wardrobe.outfit.outerId === garment.id ? worn : undefined;

  return (
    <FitDetails
      garment={garment}
      model={model}
      preference={preference}
      initialSize={size}
      units={units}
      under={under}
      // Each zone's chances are for Test mode only (development and the preview build), as on the web.
      showOdds={DEV_TOOLS && testMode}
      actionLabel={(s) => (fromFitting ? (s === size ? 'Done' : `Wear ${s}`) : `Try ${s} in the fitting room`)}
      onAction={(s) => {
        setOutfit(wearGarment(wardrobe.outfit, garment, s));
        if (fromFitting) close();
        else router.dismissTo('/fitting-room');
      }}
      onEditBody={() => {
        close();
        router.push('/body');
      }}
    />
  );
}
