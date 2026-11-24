import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { canAnchor, type Anchor } from '@choudo/core/domain/fit';
import { GARMENTS, type Garment } from '@choudo/core/domain/garments';

import { ThemedText } from '@/components/themed-text';
import { colors, fonts, radius, spacing } from '@/theme';

import { OptionCard, stepStyles } from './option-card';
import { StepActions } from './step-actions';

export const ANCHOR_GARMENTS: Garment[] = GARMENTS.filter(canAnchor);

type CatalogueAnchor = Extract<Anchor, { kind: 'catalogue' }>;

/** "Which tee, and what size?": a tee we list and the size the user owns. */
export function CatalogueStep({
  initial,
  onSave,
  onBack,
}: {
  initial: CatalogueAnchor | null;
  onSave: (anchor: Anchor) => void;
  onBack: () => void;
}) {
  const [garmentId, setGarmentId] = useState(initial?.garmentId ?? ANCHOR_GARMENTS[0]?.id ?? '');
  const garment = ANCHOR_GARMENTS.find((g) => g.id === garmentId);
  const [size, setSize] = useState<string | null>(initial?.size ?? null);
  const sizeOk = garment?.sizes.some((s) => s.label === size) ?? false;

  return (
    <View style={stepStyles.form}>
      <View style={stepStyles.list} accessibilityRole="radiogroup" accessibilityLabel="Tee">
        {ANCHOR_GARMENTS.map((g) => (
          <OptionCard
            key={g.id}
            title={g.name}
            subtitle={g.brand}
            titleFirst={false}
            selected={g.id === garmentId}
            onPress={() => {
              setGarmentId(g.id);
              setSize(null);
            }}
            // The garment pictures arrive with the shared garment icon (PR 5).
            leading={<View style={[styles.swatch, { backgroundColor: g.color }]} />}
          />
        ))}
      </View>

      {garment && (
        <View>
          <ThemedText style={styles.legend}>The size you own</ThemedText>
          <View style={styles.sizes} accessibilityRole="radiogroup" accessibilityLabel="The size you own">
            {garment.sizes.map((s) => {
              const selected = s.label === size;
              return (
                <Pressable
                  key={s.label}
                  accessibilityRole="radio"
                  accessibilityLabel={s.label}
                  accessibilityState={{ checked: selected }}
                  onPress={() => setSize(s.label)}
                  style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && styles.pressed]}>
                  <ThemedText style={[styles.pillText, selected && styles.pillTextSelected]}>{s.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <ThemedText variant="small" tone="muted">
        Not listed? Go back and measure yours instead.
      </ThemedText>
      <StepActions
        canSave={sizeOk}
        onSave={() => {
          if (garment && size && sizeOk) onSave({ kind: 'catalogue', garmentId: garment.id, size });
        }}
        onBack={onBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.fieldEdge,
  },
  legend: { fontFamily: fonts.bold, marginBottom: spacing.sm },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
  },
  pillSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  pressed: { opacity: 0.7 },
  pillText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22 },
  pillTextSelected: { color: colors.surface },
});
