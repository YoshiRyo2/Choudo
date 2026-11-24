import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View, type FlatListInstance } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Garment } from '@choudo/core/domain/garments';

import { colors, fonts, radius } from '@/theme';

import { GarmentBadge } from './garment-badge';
import { GarmentIcon } from './garment-icon';
import { ThemedText } from './themed-text';

export interface GarmentCarouselProps {
  label: string;
  garments: Garment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** A small control in the header row, after the count (the Fitting room's Show chip). */
  headerAction?: ReactNode;
}

/** GarmentCarousel.css: cards 74 % of the track (max 280), 10 apart; the track bleeds 16 to the screen edges. */
const GAP = 10;
const BLEED = 16;
const cardWidth = (trackWidth: number) => Math.min(280, 0.74 * (trackWidth - 2 * BLEED));

/**
 * Swipe sideways through garments (the web GarmentCarousel). Whichever card settles in the
 * middle is selected; tapping a card or using the arrow buttons does the same.
 */
export function GarmentCarousel({ label, garments, selectedId, onSelect, headerAction }: GarmentCarouselProps) {
  const window = useWindowDimensions();
  // The track spans the screen (it bleeds past the panel's padding): the window until it's laid out.
  const [trackWidth, setTrackWidth] = useState(window.width);
  const reduceMotion = useReducedMotion();
  const list = useRef<FlatListInstance>(null);
  const selectedIndex = Math.max(0, garments.findIndex((g) => g.id === selectedId));

  const card = cardWidth(trackWidth);
  const interval = card + GAP;
  const inset = (trackWidth - card) / 2;

  // Keep the selected card in the middle when the selection changes from outside (arrows, a tap).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    list.current?.scrollToOffset({ offset: selectedIndex * interval, animated: !reduceMotion });
  }, [selectedIndex, interval, reduceMotion]);

  const step = (delta: number) => {
    const next = garments[selectedIndex + delta];
    if (next) onSelect(next.id);
  };
  const lower = label.toLowerCase();

  return (
    <View>
      <View style={styles.header}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          {label}
        </ThemedText>
        <ThemedText variant="small" tone="muted" style={styles.count} importantForAccessibility="no" accessibilityElementsHidden>
          {`${selectedIndex + 1} of ${garments.length}`}
        </ThemedText>
        {headerAction}
        <View style={styles.arrows}>
          <Arrow direction="prev" label={`Previous ${lower}`} disabled={selectedIndex === 0} onPress={() => step(-1)} />
          <Arrow direction="next" label={`Next ${lower}`} disabled={selectedIndex === garments.length - 1} onPress={() => step(1)} />
        </View>
      </View>
      <FlatList
        ref={list}
        testID="carousel-track"
        accessibilityLabel={label}
        horizontal
        data={garments}
        keyExtractor={(g) => g.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        initialScrollIndex={selectedIndex}
        getItemLayout={(_, index) => ({ length: card, offset: index * interval, index })}
        style={styles.track}
        contentContainerStyle={[styles.trackContent, { paddingHorizontal: inset }]}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        onMomentumScrollEnd={(e) => {
          const index = Math.min(garments.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / interval)));
          const id = garments[index]?.id;
          if (id && id !== selectedId) onSelect(id);
        }}
        renderItem={({ item }) => {
          const selected = item.id === selectedId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.brand} ${item.name}`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(item.id)}
              style={({ pressed }) => [styles.card, { width: card }, selected && styles.cardSelected, pressed && styles.pressed]}>
              <GarmentIcon garment={item} />
              <View style={styles.text}>
                <ThemedText variant="small" tone="muted" numberOfLines={1}>
                  {item.brand}
                </ThemedText>
                <ThemedText style={styles.name} numberOfLines={2}>
                  {item.name}
                </ThemedText>
                <View style={styles.flag}>
                  <GarmentBadge garment={item} />
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/** A 36 pt circle with a 44 pt hit area (GarmentCarousel.css). */
function Arrow({ direction, label, disabled, onPress }: { direction: 'prev' | 'next'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.arrow, disabled && styles.arrowDisabled, pressed && styles.pressed]}>
      <View style={[styles.chevron, direction === 'prev' ? styles.chevronPrev : styles.chevronNext]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 24 },
  count: { fontVariant: ['tabular-nums'] },
  arrows: { marginLeft: 'auto', flexDirection: 'row', gap: 14 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.4 },
  chevron: { width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.ink },
  chevronPrev: { transform: [{ translateX: 1 }, { rotate: '45deg' }] },
  chevronNext: { transform: [{ translateX: -1 }, { rotate: '-135deg' }] },
  track: { marginHorizontal: -BLEED },
  trackContent: { gap: GAP, paddingTop: 4, paddingBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.m,
  },
  // The web's ink border plus an inset ink ring: 2.5 in all.
  cardSelected: { borderColor: colors.ink, borderWidth: 2.5, paddingVertical: 11, paddingHorizontal: 13 },
  pressed: { opacity: 0.7 },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bold, lineHeight: 20 },
  flag: { marginTop: 4 },
});
