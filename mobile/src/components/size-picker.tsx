import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { FitTone, GarmentFit, GarmentOdds } from '@choudo/core/domain/fit';
import { centredScrollLeft, chipTone } from '@choudo/core/ui-logic/components/sizeRow';

import { colors, fonts, radius } from '@/theme';

import { toneColor } from './tone';

export interface SizePickerProps {
  fits: GarmentFit[];
  selected: string | null;
  recommended: string | null;
  onSelect: (size: string) => void;
  /** The garment's odds: each dot then takes that size's likeliest verdict's colour. Without them, the chart-only fit. */
  odds?: GarmentOdds;
  /**
   * 'wrap' (default): chips wrap onto more rows. 'row': one row that scrolls sideways,
   * keeping the selected chip in the middle (give it a `key` per garment so it re-centres).
   */
  layout?: 'wrap' | 'row';
}

const TONE_NAME: Record<FitTone, string> = {
  good: 'fits',
  warn: 'fits with a caveat',
  bad: 'likely won’t fit',
  unknown: 'fit unknown',
};

/** The row's side padding: the first chip lines up with the text above (SizePicker.css). */
const ROW_PAD = 16;

/** One chip per size, each with a dot showing how that size would fit (the web SizePicker). */
export function SizePicker({ fits, selected, recommended, onSelect, odds, layout = 'wrap' }: SizePickerProps) {
  const isRow = layout === 'row';
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ScrollViewInstance>(null);
  const rowWidth = useRef(0);
  const contentWidth = useRef(0);
  const chips = useRef(new Map<string, { x: number; width: number }>());
  const centred = useRef(false);

  const centreSelected = (animated: boolean) => {
    const chip = selected === null ? undefined : chips.current.get(selected);
    if (!isRow || !chip || rowWidth.current === 0 || contentWidth.current === 0) return;
    const x = centredScrollLeft({ clientWidth: rowWidth.current, scrollWidth: contentWidth.current }, { offsetLeft: chip.x, width: chip.width });
    scroll.current?.scrollTo({ x, animated });
    centred.current = true;
  };

  // A size picked from elsewhere (or a chip at the edge) slides into the middle; the
  // first time (a new garment) it jumps straight there.
  useEffect(() => {
    if (centred.current) centreSelected(!reduceMotion);
  }, [selected]);
  const measured = () => {
    if (!centred.current) centreSelected(false);
  };

  const chipsView = fits.map((fit) => {
    const isSelected = fit.sizeLabel === selected;
    const isRecommended = fit.sizeLabel === recommended;
    const tone = chipTone(fit, odds);
    const color = toneColor[tone];
    return (
      <Pressable
        key={fit.sizeLabel}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected, checked: isSelected }}
        accessibilityLabel={`${fit.sizeLabel}, ${TONE_NAME[tone]}${isRecommended ? ', suggested size' : ''}`}
        onPress={() => onSelect(fit.sizeLabel)}
        onLayout={(e) => {
          chips.current.set(fit.sizeLabel, { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width });
          if (isSelected) measured();
        }}
        style={({ pressed }) => [styles.chip, isSelected && styles.chipSelected, pressed && styles.pressed]}>
        <Text style={[styles.label, isSelected && styles.labelSelected]}>{fit.sizeLabel}</Text>
        <View
          testID={`size-dot-${fit.sizeLabel}`}
          style={[
            styles.dot,
            tone === 'unknown' ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color },
            isSelected && styles.dotSelected,
          ]}
        />
        {/* The chip's name says "suggested size" already, so this tag is decoration. */}
        {isRecommended && (
          <View style={styles.suggested} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
            <Text style={styles.suggestedText}>Suggested</Text>
          </View>
        )}
      </Pressable>
    );
  });

  if (!isRow) {
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel="Size" style={styles.wrap}>
        {chipsView}
      </View>
    );
  }
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel="Size"
      style={styles.rowScroll}
      contentContainerStyle={styles.row}
      onLayout={(e) => {
        rowWidth.current = e.nativeEvent.layout.width;
        measured();
      }}
      onContentSizeChange={(w) => {
        contentWidth.current = w;
        measured();
      }}>
      {chipsView}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Even rows; the gap and top padding leave room for the "Suggested" tag on a chip's top edge.
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12, paddingTop: 8 },
  // Bleeds to the screen edges, keeping the first chip in line with the text.
  rowScroll: { marginHorizontal: -ROW_PAD, flexGrow: 0 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: ROW_PAD, paddingTop: 8, paddingBottom: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 64,
    minHeight: 48,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.pill,
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
  labelSelected: { color: colors.surface },
  dot: { width: 8, height: 8, borderRadius: 4 },
  // A ring of surface keeps the dot readable on the ink chip (box-shadow 0 0 0 1.5px).
  dotSelected: { outlineWidth: 1.5, outlineColor: colors.surface, outlineStyle: 'solid' },
  suggested: {
    position: 'absolute',
    top: -9,
    paddingHorizontal: 5,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.stamp,
    borderRadius: radius.pill,
  },
  suggestedText: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.2, color: colors.stamp },
});
