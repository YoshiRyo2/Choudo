import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Anchor, FitStyle } from '@choudo/core/domain/fit';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { colors, spacing } from '@/theme';

import { ANCHOR_GARMENTS, CatalogueStep } from './catalogue-step';
import { ChooseStep, type Step } from './choose-step';
import { MeasureStep } from './measure-step';
import { StyleStep } from './style-step';

export interface FitReferenceScreenProps {
  units: UnitSystem;
  anchor: Anchor | null;
  style: FitStyle | null;
  /** Save the new reference and leave. Picking a style clears the anchor. */
  onDone: (anchor: Anchor | null, style: FitStyle | null) => void;
  /** Leave without changing anything. */
  onSkip: () => void;
  /** "Skip for now" the first time, "Cancel" from Edit body. */
  skipLabel: string;
}

const HEADING: Record<Step, string> = {
  choose: 'Got a tee that fits the way you like?',
  catalogue: 'Which tee, and what size?',
  measure: 'Measure your tee',
  style: 'How do you like tees to fit?',
};

/** A stored catalogue tee, if we still list it (an old one is treated as none). */
function listedTee(anchor: Anchor | null) {
  return anchor?.kind === 'catalogue' && ANCHOR_GARMENTS.some((g) => g.id === anchor.garmentId) ? anchor : null;
}

/** The step matching what's stored. A tee we no longer list counts as no tee. */
function firstStep(anchor: Anchor | null, style: FitStyle | null): Step {
  if (listedTee(anchor)) return 'catalogue';
  if (anchor?.kind === 'measured') return 'measure';
  return style ? 'style' : 'choose';
}

/** "Got a tee that fits the way you like?" — a personal fit reference, or a quick question instead. */
export function FitReferenceScreen({ units, anchor, style, onDone, onSkip, skipLabel }: FitReferenceScreenProps) {
  const [step, setStep] = useState<Step>(() => firstStep(anchor, style));
  const back = () => setStep('choose');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      <View>
        <Wordmark />
        <ThemedText variant="title" accessibilityRole="header" style={styles.heading}>
          {HEADING[step]}
        </ThemedText>
        {step === 'choose' && (
          <ThemedText tone="muted" style={styles.lede}>
            We’ll use it to judge every other top: roomier, snugger, or just how you like it.
          </ThemedText>
        )}
      </View>

      {step === 'choose' && <ChooseStep onChoose={setStep} />}
      {step === 'catalogue' && (
        <CatalogueStep initial={listedTee(anchor)} onSave={(a) => onDone(a, style)} onBack={back} />
      )}
      {step === 'measure' && <MeasureStep units={units} initial={anchor} onSave={(a) => onDone(a, style)} onBack={back} />}
      {step === 'style' && <StyleStep initial={style} onSave={(s) => onDone(null, s)} onBack={back} />}

      <View style={styles.skip}>
        <Button variant="quiet" title={skipLabel} onPress={onSkip} />
      </View>
      <ThemedText variant="small" tone="muted">
        Saved on this device only.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { gap: 22, paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: 40 },
  heading: { marginTop: 18 },
  lede: { marginTop: spacing.sm },
  skip: { borderTopWidth: 1, borderColor: colors.line, paddingTop: spacing.sm },
});
