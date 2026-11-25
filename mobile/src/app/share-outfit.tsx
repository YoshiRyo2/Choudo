import { useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { showsOutfit } from '@choudo/core/ui-logic/state/closet';

import { MascotHeadContext } from '@/components/mannequin/head-context';
import { useCloset } from '@/hooks/use-closet';
import { useLeaveIf } from '@/hooks/use-leave-if';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { ShareOutfit } from '@/screens/share-outfit';

/**
 * Share a saved outfit as an image, a form sheet: `?id=`. An outfit that's gone, or one the
 * Closet doesn't show (it wears a sample in a store build), closes it.
 */
export default function ShareOutfitRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const closet = useCloset();
  const wardrobe = useWardrobe();
  const head = useContext(MascotHeadContext);
  const stored = closet.outfits.find((o) => o.id === id);
  const outfit = stored && wardrobe && showsOutfit(stored, wardrobe.garments) ? stored : undefined;
  const leave = useLeaveIf(!outfit || !wardrobe);
  if (leave !== undefined) return leave;
  return <ShareOutfit outfit={outfit!} body={wardrobe!.model.measurements} head={head} garments={wardrobe!.garments} />;
}
