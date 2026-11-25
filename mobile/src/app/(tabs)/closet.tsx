import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useState } from 'react';

import { useCloset } from '@/hooks/use-closet';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { Closet } from '@/screens/closet';
import { confirmDelete } from '@/utils/confirm-delete';

export default function ClosetRoute() {
  const wardrobe = useWardrobe();
  const closet = useCloset();
  // All native tabs render at launch: like Discover, draw nothing until this one is opened.
  const [opened, setOpened] = useState(false);
  useFocusEffect(useCallback(() => setOpened(true), []));
  // Mounted for good once opened: the Liked tiles only work their odds out while it's on screen.
  const focused = useIsFocused();
  if (!wardrobe || !opened) return null;
  return (
    <Closet
      model={wardrobe.model}
      preference={wardrobe.preference}
      garments={wardrobe.garments}
      closet={closet}
      current={wardrobe.outfit}
      onOpenGarment={(garment, size) => router.push({ pathname: '/fit-details', params: { garmentId: garment.id, size, from: 'browse' } })}
      onFolders={(item, title) => router.push({ pathname: '/folder-picker', params: { kind: item.kind, id: item.id, title } })}
      onOpenFolder={(id) => router.push({ pathname: '/folder/[id]', params: { id } })}
      onWear={(outfit) => {
        wardrobe.setOutfit(outfit);
        router.navigate('/');
      }}
      onShare={(id) => router.push({ pathname: '/share-outfit', params: { id } })}
      onDeleteOutfit={(id, name) => confirmDelete(name, () => closet.deleteOutfit(id))}
      onOpenDiscover={() => router.navigate('/discover')}
      onAbout={() => router.push('/about')}
      active={focused}
    />
  );
}
