import { Redirect, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { findGarment } from '@choudo/core/domain/garments';
import { wearGarment } from '@choudo/core/ui-logic/state/outfit';

import { underLayer, useWardrobe } from '@/hooks/use-wardrobe';
import { FitDetails } from '@/screens/fit-details';

/** Leave the sheet for whatever is under it (the Fitting room on a cold start). */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Fit details, a form sheet: `?garmentId=&size=&from=fitting|browse`. From the Fitting
 * room the button wears the size picked ("Done" for the one worn) and closes; from
 * browsing (Discover, the Closet) it puts the garment on and goes to the Fitting room.
 */
export default function FitDetailsRoute() {
  const params = useLocalSearchParams<{ garmentId?: string; size?: string; from?: string }>();
  const wardrobe = useWardrobe();
  const garment = params.garmentId ? findGarment(params.garmentId) : undefined;
  const missing = !wardrobe || !garment;
  // A garment we don't have (a stale link): close at once. The screen's own navigation, as
  // the imperative router isn't bound until after the first render.
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  useEffect(() => {
    if (missing && canGoBack) navigation.goBack();
  }, [missing, canGoBack, navigation]);
  if (missing) return canGoBack ? null : <Redirect href="/" />;

  const { model, preference, units, outfit, setOutfit } = wardrobe;
  const fromFitting = params.from !== 'browse';
  const size = garment.sizes.some((s) => s.label === params.size) ? params.size! : garment.sizes[0]!.label;
  // As the web Fitting room's activeUnder: the jacket on the mannequin is fitted over what's under it.
  const under = fromFitting && garment.category === 'outer' && outfit.outerId === garment.id ? underLayer(outfit) : undefined;

  return (
    <FitDetails
      garment={garment}
      model={model}
      preference={preference}
      initialSize={size}
      units={units}
      under={under}
      actionLabel={(s) => (fromFitting ? (s === size ? 'Done' : `Wear ${s}`) : `Try ${s} in the fitting room`)}
      onAction={(s) => {
        setOutfit(wearGarment(outfit, garment, s));
        if (fromFitting) close();
        else router.dismissTo('/');
      }}
      onEditBody={() => {
        close();
        router.push('/body');
      }}
    />
  );
}
