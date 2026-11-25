import { StyleSheet, View } from 'react-native';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import type { Garment } from '@choudo/core/domain/garments';
import type { Outfit } from '@choudo/core/ui-logic/state/stored';

import { Mannequin, type WornGarment } from '@/components/mannequin';
import { colors, radius } from '@/theme';

/** A garment id + size from an outfit, ready for the mannequin (or undefined if it's gone or hidden). */
function worn(garments: readonly Garment[], id: string | null, size: string | null): WornGarment | undefined {
  const garment = id ? garments.find((g) => g.id === id) : undefined;
  return garment && size ? { garment, sizeLabel: size } : undefined;
}

/**
 * An outfit's slots for the Mannequin's props; garments not in `garments` (the ones the app
 * may show: gone, or a sample in a store build) are left off.
 */
export function wornOf(outfit: Outfit, garments: readonly Garment[]) {
  return {
    top: worn(garments, outfit.topId, outfit.topSize),
    bottom: worn(garments, outfit.bottomId, outfit.bottomSize),
    onepiece: worn(garments, outfit.onepieceId, outfit.onepieceSize),
    outer: worn(garments, outfit.outerId, outfit.outerSize),
  };
}

/** A small mannequin wearing an outfit (the web OutfitFigure), on a peach panel. */
export function OutfitFigure({ body, outfit, garments }: { body: BodyMeasurements; outfit: Outfit; garments: readonly Garment[] }) {
  return (
    <View style={styles.figure}>
      <Mannequin body={body} {...wornOf(outfit, garments)} showFit={false} frame="canvas" showHeightTape={false} face="unknown" />
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { height: 160, marginBottom: 8, paddingTop: 6, backgroundColor: colors.peachTint, borderRadius: radius.s },
});
