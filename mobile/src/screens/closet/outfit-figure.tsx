import { StyleSheet, View } from 'react-native';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import type { Outfit } from '@choudo/core/ui-logic/state/stored';

import { Mannequin, type WornGarment } from '@/components/mannequin';
import { useFindGarment, type FindGarment } from '@/hooks/use-fetched';
import { colors, radius } from '@/theme';

/** A garment id + size from an outfit, ready for the mannequin (or undefined if it's gone). */
function worn(find: FindGarment, id: string | null, size: string | null): WornGarment | undefined {
  const garment = id ? find(id) : undefined;
  return garment && size ? { garment, sizeLabel: size } : undefined;
}

/** An outfit's slots for the Mannequin's props; garments no longer in the catalogue are left off. */
export function wornOf(outfit: Outfit, find: FindGarment) {
  return {
    top: worn(find, outfit.topId, outfit.topSize),
    bottom: worn(find, outfit.bottomId, outfit.bottomSize),
    onepiece: worn(find, outfit.onepieceId, outfit.onepieceSize),
    outer: worn(find, outfit.outerId, outfit.outerSize),
  };
}

/** A small mannequin wearing an outfit (the web OutfitFigure), on a peach panel. */
export function OutfitFigure({ body, outfit }: { body: BodyMeasurements; outfit: Outfit }) {
  const find = useFindGarment();
  return (
    <View style={styles.figure}>
      <Mannequin body={body} {...wornOf(outfit, find)} showFit={false} frame="canvas" showHeightTape={false} face="unknown" />
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { height: 160, marginBottom: 8, paddingTop: 6, backgroundColor: colors.peachTint, borderRadius: radius.s },
});
