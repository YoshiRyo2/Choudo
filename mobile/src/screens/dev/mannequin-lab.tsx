import { useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { estimateBody, INPUT_LIMITS } from '@choudo/core/domain/body';
import { fitOutfit, type FitTone } from '@choudo/core/domain/fit';
import { findGarment, garmentsByCategory, type GarmentCategory } from '@choudo/core/domain/garments';
import { HEAD_KINDS, HEAD_NAME, type HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import type { View as Side } from '@choudo/core/ui-logic/components/Mannequin/view';
import { PREVIEW_BODY } from '@choudo/core/ui-logic/screens/bodyPreview';

import { Button } from '@/components/button';
import { Mannequin, type WornGarment } from '@/components/mannequin';
import { MascotHeadContext } from '@/components/mannequin/head-context';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { useBody } from '@/hooks/use-body';
import { colors, fonts, radius, spacing } from '@/theme';

/**
 * Development only (the route redirects in a store build): every garment template, head,
 * face and side on the phone, to compare with the website by eye. Nothing here is saved.
 */

type Picked = { id: string; size: string } | null;
type Picks = Record<GarmentCategory, Picked>;

const SLOTS: { slot: GarmentCategory; title: string }[] = [
  { slot: 'top', title: 'Top' },
  { slot: 'bottom', title: 'Bottom' },
  { slot: 'onepiece', title: 'Dress' },
  { slot: 'outer', title: 'Jacket' },
];

const NONE: Picks = { top: null, bottom: null, onepiece: null, outer: null };
const STEP_CM = 5;

/** Wear one garment in its middle size (tap again to take it off). A dress takes the top's and the bottom's place. */
function choose(picks: Picks, slot: GarmentCategory, id: string): Picks {
  if (picks[slot]?.id === id) return { ...picks, [slot]: null };
  const sizes = findGarment(id)!.sizes;
  const next = { ...picks, [slot]: { id, size: sizes[Math.floor((sizes.length - 1) / 2)]!.label } };
  if (slot === 'onepiece') return { ...next, top: null, bottom: null };
  if (slot === 'top' || slot === 'bottom') return { ...next, onepiece: null };
  return next;
}

export function MannequinLab({ onDone }: { onDone?: () => void }) {
  const [stored] = useBody();
  const base = stored ?? PREVIEW_BODY.womens;
  const [heightCm, setHeightCm] = useState(base.heightCm);
  const [head, setHead] = useState<HeadKind>(useContext(MascotHeadContext));
  const [face, setFace] = useState<FitTone>('unknown');
  const [side, setSide] = useState<Side>('front');
  const [frame, setFrame] = useState<'canvas' | 'body'>('canvas');
  const [picks, setPicks] = useState<Picks>(NONE);

  const model = useMemo(() => estimateBody({ ...base, heightCm }), [base, heightCm]);
  const worn = useMemo(() => {
    const layers: Partial<Record<GarmentCategory, WornGarment>> = {};
    for (const { slot } of SLOTS) {
      const p = picks[slot];
      if (p) layers[slot] = { garment: findGarment(p.id)!, sizeLabel: p.size };
    }
    // As the Fitting room does: a jacket is fitted over the top (or dress) under it.
    const fit = fitOutfit(model, layers);
    for (const { slot } of SLOTS) {
      const layer = layers[slot];
      if (layer) layers[slot] = { ...layer, fit: fit[slot] };
    }
    return layers;
  }, [model, picks]);

  const step = (by: number) =>
    setHeightCm((h) => Math.min(INPUT_LIMITS.heightCm.max, Math.max(INPUT_LIMITS.heightCm.min, h + by)));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <ThemedText variant="title" accessibilityRole="header">
          Mannequin lab
        </ThemedText>
        {onDone && <Button variant="quiet" size="sm" title="Done" onPress={onDone} />}
      </View>

      <View style={styles.figure}>
        <Mannequin body={model.measurements} {...worn} head={head} face={face} view={side} frame={frame} />
      </View>

      <View style={styles.row}>
        <Chip label="Shorter by 5 cm" text="−5 cm" onPress={() => step(-STEP_CM)} />
        <ThemedText style={styles.height}>{`${heightCm} cm`}</ThemedText>
        <Chip label="Taller by 5 cm" text="+5 cm" onPress={() => step(STEP_CM)} />
      </View>

      <Segmented label="Head" value={head} options={HEAD_KINDS.map((h) => ({ value: h, label: HEAD_NAME[h] }))} onChange={setHead} />
      <Segmented
        label="Face"
        value={face}
        options={(['good', 'warn', 'bad', 'unknown'] as const).map((f) => ({ value: f, label: f }))}
        onChange={setFace}
      />
      <Segmented
        label="Side"
        value={side}
        options={[
          { value: 'front', label: 'Front' },
          { value: 'back', label: 'Back' },
        ]}
        onChange={setSide}
      />
      <Segmented
        label="Frame"
        value={frame}
        options={[
          { value: 'canvas', label: 'Canvas' },
          { value: 'body', label: 'Body' },
        ]}
        onChange={setFrame}
      />

      {SLOTS.map(({ slot, title }) => {
        const picked = picks[slot];
        const sizes = picked ? findGarment(picked.id)!.sizes : [];
        return (
          <View key={slot} style={styles.slot}>
            <ThemedText style={styles.slotTitle}>{title}</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {garmentsByCategory(slot).map((g) => (
                <Chip
                  key={g.id}
                  label={`${g.brand} ${g.name}`}
                  text={g.name}
                  selected={picked?.id === g.id}
                  onPress={() => setPicks((p) => choose(p, slot, g.id))}
                />
              ))}
            </ScrollView>
            {picked && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {sizes.map((s) => (
                  <Chip
                    key={s.label}
                    label={`${title} size ${s.label}`}
                    text={s.label}
                    selected={picked.size === s.label}
                    onPress={() => setPicks((p) => ({ ...p, [slot]: { id: picked.id, size: s.label } }))}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Chip({ label, text, selected = false, onPress }: { label: string; text: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}>
      <ThemedText variant="small" style={selected ? styles.chipTextOn : undefined} numberOfLines={1}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  figure: { height: 460, backgroundColor: colors.surface, borderRadius: radius.m, padding: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  height: { fontFamily: fonts.bold, minWidth: 64, textAlign: 'center' },
  slot: { gap: spacing.sm },
  slotTitle: { fontFamily: fonts.bold },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    maxWidth: 220,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipTextOn: { color: colors.surface },
  pressed: { opacity: 0.7 },
});
