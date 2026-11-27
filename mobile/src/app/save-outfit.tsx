import { Redirect, router } from 'expo-router';
import { nextOutfitName } from '@choudo/core/ui-logic/state/closet';

import { useCloset } from '@/hooks/use-closet';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { SaveOutfit } from '@/screens/save-outfit';

/** Save outfit, a form sheet over the Fitting room: what's on the mannequin, under a name. */
export default function SaveOutfitRoute() {
  const wardrobe = useWardrobe();
  const closet = useCloset();
  if (!wardrobe) return <Redirect href="/" />;
  return (
    <SaveOutfit
      placeholder={nextOutfitName(closet.outfits)}
      // The resolved outfit: what the mannequin shows, even when nothing was picked yet.
      onSave={(name) => closet.saveOutfit(wardrobe.outfit, name)}
      onDone={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/fitting-room');
      }}
    />
  );
}
