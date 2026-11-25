import { estimateBody } from '@choudo/core/domain/body';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useBody } from '@/hooks/use-body';
import { useCatalogue } from '@/hooks/use-catalogue';
import { useCloset } from '@/hooks/use-closet';
import { useGarments } from '@/hooks/use-garments';
import { usePreference } from '@/hooks/use-preference';
import { Discover } from '@/screens/discover';

export default function DiscoverRoute() {
  // Only what Discover reads (not useWardrobe: picks in the Fitting room don't concern it).
  const [body] = useBody();
  const model = useMemo(() => (body ? estimateBody(body) : null), [body]);
  const preference = usePreference();
  const [catalogue, setCatalogue] = useCatalogue();
  const closet = useCloset();
  const garments = useGarments();

  // Native tabs stay mounted, and all of them render at launch: draw nothing until the tab is
  // first opened. After that, a fresh feed when it regains focus with swipes changed elsewhere
  // (an unlike in the Closet), never while it's on screen and not after a sheet over it closes.
  const [feedKey, setFeedKey] = useState(0);
  const swipes = useRef(closet.swipes);
  swipes.current = closet.swipes;
  const atBlur = useRef(closet.swipes);
  useFocusEffect(
    useCallback(() => {
      setFeedKey((key) => (key === 0 || swipes.current !== atBlur.current ? key + 1 : key));
      return () => {
        atBlur.current = swipes.current;
      };
    }, []),
  );

  // Stays mounted once opened: the next cards' odds are only worked out while it's on screen.
  const focused = useIsFocused();
  if (!body || !model || feedKey === 0) return null;
  return (
    <Discover
      catalogue={catalogue}
      onCatalogueChange={setCatalogue}
      model={model}
      bodyType={body.bodyType}
      preference={preference}
      closet={closet}
      garments={garments}
      feedKey={feedKey}
      onOpenDetails={(garment, size) => router.push({ pathname: '/fit-details', params: { garmentId: garment.id, size, from: 'browse' } })}
      onOpenCloset={() => router.navigate('/closet')}
      active={focused}
    />
  );
}
