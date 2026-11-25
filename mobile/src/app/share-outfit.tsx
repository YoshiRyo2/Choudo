import { useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';

import { MascotHeadContext } from '@/components/mannequin/head-context';
import { useCloset } from '@/hooks/use-closet';
import { useLeaveIf } from '@/hooks/use-leave-if';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { ShareOutfit } from '@/screens/share-outfit';

/** Share a saved outfit as an image, a form sheet: `?id=`. An outfit that's gone closes it. */
export default function ShareOutfitRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const closet = useCloset();
  const wardrobe = useWardrobe();
  const head = useContext(MascotHeadContext);
  const outfit = closet.outfits.find((o) => o.id === id);
  const leave = useLeaveIf(!outfit || !wardrobe);
  if (leave !== undefined) return leave;
  return <ShareOutfit outfit={outfit!} body={wardrobe!.model.measurements} head={head} />;
}
