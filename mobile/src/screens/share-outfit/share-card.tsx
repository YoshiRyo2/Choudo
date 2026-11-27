import { forwardRef } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import { outfitGarmentLines } from '@choudo/core/ui-logic/closetText';
import type { HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import type { Outfit } from '@choudo/core/ui-logic/state/stored';

import { Mannequin } from '@/components/mannequin';
import { Wordmark } from '@/components/wordmark';
import { colors, fonts, type } from '@/theme';

import { useFindGarment, useKnownGarments } from '@/hooks/use-fetched';

import { wornOf } from '../closet/outfit-figure';

/** The card's size in points (4:5); it's captured at 3× (1080 × 1350). */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 450;

export interface ShareCardProps {
  outfit: Outfit & { name: string };
  body: BodyMeasurements;
  head: HeadKind;
}

/**
 * The image a saved outfit is shared as: the mascot mannequin wearing it, the outfit's name,
 * each garment and size, and the wordmark. Never the body in words (no height, weight,
 * measurements or body type): the figure is drawn to the body, nothing more is said.
 */
export const ShareCard = forwardRef<ViewInstance, ShareCardProps>(function ShareCard({ outfit, body, head }, ref) {
  const find = useFindGarment();
  const garments = useKnownGarments();
  return (
    <View ref={ref} collapsable={false} style={styles.card} testID="share-card">
      <View style={styles.stage}>
        <View style={styles.circle} />
        <Mannequin body={body} {...wornOf(outfit, find)} head={head} showFit={false} frame="body" showHeightTape={false} face="unknown" style={styles.figure} />
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {outfit.name}
        </Text>
        {outfitGarmentLines(outfit, garments).map((line) => (
          <Text key={line} style={styles.line} numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
      <View style={styles.mark}>
        <Wordmark />
      </View>
    </View>
  );
});

const CIRCLE = 236;

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, overflow: 'hidden' },
  // The Fitting room's stage, smaller: the figure in front of a peach circle.
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.peachSoft },
  figure: { width: '100%', height: '100%' },
  text: { gap: 2, paddingTop: 10 },
  name: { ...type.title },
  line: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink },
  mark: { alignItems: 'flex-start', paddingTop: 10, transform: [{ scale: 0.8 }], transformOrigin: 'left center' },
});
