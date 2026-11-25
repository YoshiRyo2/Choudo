import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useCloset } from '@/hooks/use-closet';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { Discover } from '@/screens/discover';

export default function DiscoverRoute() {
  const wardrobe = useWardrobe();
  const closet = useCloset();
  // Native tabs stay mounted: build a fresh feed each time this tab gains focus, so likes and
  // unlikes made elsewhere show, and never while it's on screen.
  const [feedKey, setFeedKey] = useState(0);
  useFocusEffect(useCallback(() => setFeedKey((key) => key + 1), []));
  if (!wardrobe) return null;
  return (
    <Discover
      catalogue={wardrobe.catalogue}
      onCatalogueChange={wardrobe.setCatalogue}
      model={wardrobe.model}
      bodyType={wardrobe.body.bodyType}
      preference={wardrobe.preference}
      closet={closet}
      feedKey={feedKey}
      onOpenDetails={(garment, size) => router.push({ pathname: '/fit-details', params: { garmentId: garment.id, size, from: 'browse' } })}
      onOpenCloset={() => router.navigate('/closet')}
    />
  );
}
