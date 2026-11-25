import { StyleSheet, View } from 'react-native';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import { findGarment } from '@choudo/core/domain/garments';
import type { Outfit } from '@choudo/core/ui-logic/state/stored';

import { Mannequin, type WornGarment } from '@/components/mannequin';
import { colors, radius } from '@/theme';

/** A garment id + size from an outfit, ready for the mannequin (or undefined if it's gone). */
function worn(id: string | null, size: string | null): WornGarment | undefined {
  const garment = id ? findGarment(id) : undefined;
  return garment && size ? { garment, sizeLabel: size } : undefined;
}

/** An outfit's slots for the Mannequin's props; garments no longer in the catalogue are left off. */
export function wornOf(outfit: Outfit) {
  return {
    top: worn(outfit.topId, outfit.topSize),
    bottom: worn(outfit.bottomId, outfit.bottomSize),
    onepiece: worn(outfit.onepieceId, outfit.onepieceSize),
    outer: worn(outfit.outerId, outfit.outerSize),
  };
}

/** A small mannequin wearing an outfit (the web OutfitFigure), on a peach panel. */
export function OutfitFigure({ body, outfit }: { body: BodyMeasurements; outfit: Outfit }) {
  return (
    <View style={styles.figure}>
      <Mannequin body={body} {...wornOf(outfit)} showFit={false} frame="canvas" showHeightTape={false} face="unknown" />
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { height: 160, marginBottom: 8, paddingTop: 6, backgroundColor: colors.peachTint, borderRadius: radius.s },
});
