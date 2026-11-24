import { StyleSheet, View } from 'react-native';
import type { GarmentOdds } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { fittingHeadline } from '@choudo/core/ui-logic/fitText';

import { colors, type } from '@/theme';

import { ThemedText } from './themed-text';
import { toneColor } from './tone';

export interface FitAnswerProps {
  garment: Pick<Garment, 'category' | 'fitIntent'>;
  /** The size on the mannequin. */
  size: string;
  /** The garment's odds; `odds.recommended` (recommendSize) is the suggested size, or null. */
  odds: GarmentOdds;
}

/**
 * The Fitting room's plain answer (the web FitAnswer): "M fits you" (or "Your best bet: M")
 * and one verdict line for the size shown. No numbers here; they're in Fit details.
 */
export function FitAnswer({ garment, size, odds }: FitAnswerProps) {
  const answer = fittingHeadline(odds, size, garment);
  const color = toneColor[answer.tone];
  return (
    <View style={styles.answer} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${answer.headline}. ${answer.line}`}>
      {/* The fallback is a sentence, not a size: title size so it doesn't shout. */}
      <ThemedText variant={odds.recommended ? 'headline' : 'title'} style={odds.recommended ? styles.headline : styles.fallback}>
        {answer.headline}
      </ThemedText>
      <View style={styles.line}>
        <View
          testID="fit-answer-dot"
          style={[styles.dot, answer.tone === 'unknown' ? { borderWidth: 2, borderColor: color } : { backgroundColor: color }]}
        />
        {/* Text stays ink; the dot carries the fit colour. */}
        <ThemedText style={styles.text}>{answer.line}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  answer: { gap: 6, minWidth: 0 },
  headline: { lineHeight: 44, letterSpacing: -0.4 },
  fallback: { lineHeight: 26 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { ...type.body, flexShrink: 1, color: colors.ink },
});
