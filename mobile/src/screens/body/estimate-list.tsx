import type { BodyModel } from '@choudo/core/domain/body';
import { cmToIn, round } from '@choudo/core/domain/units';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fonts, spacing } from '@/theme';

type Key = 'chestCm' | 'waistCm' | 'hipsCm' | 'inseamCm';

/** The body's four girths and inseam, each marked yours / from bra size / estimate. */
export function EstimateList({ model, units }: { model: BodyModel; units: UnitSystem }) {
  const metric = units === 'metric';
  const fmt = (cm: number) => (metric ? `${Math.round(cm)} cm` : `${round(cmToIn(cm), 1)} in`);
  const rows: [string, Key][] = [
    [model.measurements.bodyType === 'womens' ? 'Bust' : 'Chest', 'chestCm'],
    ['Waist', 'waistCm'],
    ['Hips', 'hipsCm'],
    ['Inseam', 'inseamCm'],
  ];
  const sourceText = (key: Key) => {
    if (model.sources[key] === 'entered') return 'yours';
    if (key === 'chestCm' && model.bra?.setsBust) return 'from bra size';
    return 'estimate';
  };
  return (
    <View style={styles.list}>
      {rows.map(([label, key]) => (
        <View key={key} accessible accessibilityLabel={`${label}, ${fmt(model.measurements[key])}, ${sourceText(key)}`}>
          <ThemedText variant="small" tone="muted">
            {label}
          </ThemedText>
          <ThemedText style={styles.value}>{fmt(model.measurements[key])}</ThemedText>
          <ThemedText variant="small" tone="muted" style={styles.source}>
            {sourceText(key)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm + 2 },
  value: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22 },
  source: { fontSize: 12, lineHeight: 16 },
});
