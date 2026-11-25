import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BodyModel } from '@choudo/core/domain/body';
import { fitAllSizes, measurementHint, type PreferenceSpec, type UnderLayer } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { layerNoteLines } from '@choudo/core/ui-logic/fitText';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { FitReadout } from '@/components/fit-readout';
import { SizePicker } from '@/components/size-picker';
import { ThemedText } from '@/components/themed-text';
import { colors, spacing } from '@/theme';

export interface FitDetailsProps {
  garment: Garment;
  model: BodyModel;
  preference: PreferenceSpec;
  /** The size to open on. */
  initialSize: string;
  units: UnitSystem;
  /** The one button's text for a size, and what it does. */
  actionLabel: (size: string) => string;
  onAction: (size: string) => void;
  onEditBody: () => void;
  /** Worn under this garment (the Fitting room's top under a jacket): fit and odds over it. */
  under?: UnderLayer;
  /** Test mode: each zone's chances and how they were worked out. Never shown to users otherwise. */
  showOdds?: boolean;
}

/** A garment's full fit (the web FitSheet): zone by zone (each label's chance in Test mode), a size picker and one action. */
export function FitDetails({
  garment,
  model,
  preference,
  initialSize,
  units,
  actionLabel,
  onAction,
  onEditBody,
  under,
  showOdds = false,
}: FitDetailsProps) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState(initialSize);
  const fits = useMemo(() => fitAllSizes(model, garment, under), [model, garment, under]);
  const odds = useMemo(() => garmentOdds(model, garment, preference, under), [model, garment, preference, under]);
  const hint = useMemo(
    () => measurementHint(model, garment, preference, { current: odds.recommended, under }),
    [model, garment, preference, odds, under],
  );
  const fit = fits.find((f) => f.sizeLabel === size) ?? fits[0]!;

  return (
    <View style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <ThemedText variant="small" tone="muted">
            {garment.brand}
          </ThemedText>
          <ThemedText variant="title" accessibilityRole="header">
            {garment.name}
          </ThemedText>
        </View>
        <SizePicker fits={fits} selected={fit.sizeLabel} recommended={odds.recommended} odds={odds} onSelect={setSize} />
        <FitReadout
          garment={garment}
          fit={fit}
          units={units}
          odds={odds}
          preference={preference}
          hint={hint}
          showOdds={showOdds}
          layerNotes={layerNoteLines(model, under, { garment, sizeLabel: fit.sizeLabel }, units)}
          onEditBody={onEditBody}
        />
        {showOdds && (
          <ThemedText variant="small" tone="muted">
            {`Chances come from ${odds.samples} tries with your measurements, the garment’s and your taste each nudged within how sure we are of them.`}
          </ThemedText>
        )}
      </ScrollView>
      {/* The main action stays in reach while the details scroll under it. */}
      <View style={[styles.actions, { paddingBottom: 14 + insets.bottom }]}>
        <Button title={actionLabel(fit.sizeLabel)} onPress={() => onAction(fit.sizeLabel)} stretch />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.surface },
  content: { gap: 18, paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  actions: {
    paddingTop: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
