import { StyleSheet, View } from 'react-native';
import type { GarmentFit, GarmentOdds } from '@choudo/core/domain/fit';
import { templateOf, type Garment } from '@choudo/core/domain/garments';
import { fittingHeadline, reliabilityAction, reliabilityText, whyLine } from '@choudo/core/ui-logic/fitText';
import { reliability } from '@choudo/core/ui-logic/reliability';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { colors, fonts, type } from '@/theme';

import { ThemedText } from './themed-text';
import { toneColor } from './tone';

/** The web FitAnswer's extra lines: why in cm at the deciding girth, and how far to trust it. */
export interface FitAnswerDetails {
  /** Every size's fit, in chart order (the why-line compares this size with the next). */
  fits: readonly GarmentFit[];
  units: UnitSystem;
  /** The user has a fit reference (a tee they own and like). */
  hasFitReference: boolean;
  /** The bust came from a bra size, not from height and weight. */
  bustFromBra?: boolean;
  /** "Add your measurement" opens Edit body. */
  onEditBody: () => void;
}

export interface FitAnswerProps {
  garment: Pick<Garment, 'category' | 'fitIntent' | 'grade' | 'type' | 'source'>;
  /** The size on the mannequin. */
  size: string;
  /** The garment's odds; `odds.recommended` (recommendSize) is the suggested size, or null. */
  odds: GarmentOdds;
  /** With these, the why-line and the confidence line follow (the Check tab), as on the web. */
  details?: FitAnswerDetails;
}

/**
 * The plain answer (the web FitAnswer): "M fits you" (or "Your best bet: M") and one verdict
 * line for the size shown; with `details`, why in cm and how far to trust it. No numbers
 * beyond the why-line here; they're in Fit details.
 */
export function FitAnswer({ garment, size, odds, details }: FitAnswerProps) {
  const answer = fittingHeadline(odds, size, garment);
  const color = toneColor[answer.tone];
  const fit = details?.fits.find((f) => f.sizeLabel === size);
  const why = details && fit ? whyLine(details.fits, size, templateOf(garment), details.units, fit.bodyType) : null;
  const trust = details && fit ? reliability(fit, garment, { hasFitReference: details.hasFitReference }) : null;
  const trustText = trust && fit ? reliabilityText(trust, fit.bodyType, { bustFromBra: details?.bustFromBra }) : null;
  const action = trust ? reliabilityAction(trust) : null;
  return (
    <View style={styles.answer}>
      <View accessibilityLiveRegion="polite" accessible accessibilityLabel={`${answer.headline}. ${answer.line}`} style={styles.answer}>
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
      {why && (
        <ThemedText testID="fit-answer-why" style={styles.why}>
          {why}
        </ThemedText>
      )}
      {trustText && (
        <ThemedText testID="fit-answer-trust" variant="small" tone="muted">
          {trustText}
          {action && details && (
            <>
              {' '}
              <ThemedText variant="small" accessibilityRole="link" onPress={details.onEditBody} style={styles.action}>
                {action}
              </ThemedText>
            </>
          )}
        </ThemedText>
      )}
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
  why: { ...type.body, color: colors.ink },
  action: { fontFamily: fonts.bold, color: colors.ink, textDecorationLine: 'underline' },
});
