import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BodyModel } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import { findGarment, type Garment, type GarmentCategory } from '@choudo/core/domain/garments';
import { sizeLine, verdictLine } from '@choudo/core/ui-logic/fitText';
import { defaultSize, suggestedSize } from '@choudo/core/ui-logic/state/outfit';

import { Button } from '@/components/button';
import { FoldersButton } from '@/components/folders-button';
import { GarmentBadge } from '@/components/garment-badge';
import { GarmentIcon } from '@/components/garment-icon';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { toneColor } from '@/components/tone';
import { useOddsQueue } from '@/hooks/use-odds-queue';
import { colors, fonts, spacing } from '@/theme';

import { Heart, Tile, TILE_GAP, TileActions, tileText } from './tile';

type Filter = 'all' | GarmentCategory;

export interface LikedProps {
  model: BodyModel;
  preference: PreferenceSpec;
  /** Liked garment ids, newest first (closet.liked). */
  likedIds: string[];
  /** How many folders a garment is in. */
  folderCount: (garmentId: string) => number;
  onOpen: (garment: Garment, size: string) => void;
  onUnlike: (garmentId: string) => void;
  onFolders: (garment: Garment) => void;
  onOpenDiscover: () => void;
  /** False while the Closet isn't the tab on screen: tiles wait to fill in. */
  active?: boolean;
}

const FILTER_WORD: Record<Filter, string> = { all: 'garments', top: 'tops', bottom: 'bottoms', outer: 'jackets', onepiece: 'dresses' };

/**
 * Everything you've liked, newest first, filterable by tops, bottoms, jackets and dresses
 * (the web LikedTab). Each tile's size and verdict fill in as its odds are worked out.
 */
export function Liked({ model, preference, likedIds, folderCount, onOpen, onUnlike, onFolders, onOpenDiscover, active = true }: LikedProps) {
  const [filter, setFilter] = useState<Filter>('all');
  // Likes for garments no longer in the catalogue are skipped.
  const liked = useMemo(() => likedIds.map((id) => findGarment(id)).filter((g): g is Garment => g !== undefined), [likedIds]);
  const shown = useMemo(() => (filter === 'all' ? liked : liked.filter((g) => g.category === filter)), [liked, filter]);
  const odds = useOddsQueue(model, preference, shown, { active });

  if (liked.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle} accessibilityRole="header">
          Nothing liked yet
        </Text>
        <ThemedText tone="muted" style={styles.emptyText}>
          Tap the heart in Discover, or swipe right, to keep a garment here.
        </ThemedText>
        <Button title="Go to Discover" onPress={onOpenDiscover} />
      </View>
    );
  }

  return (
    <FlatList
      data={shown}
      keyExtractor={(g) => g.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={
        <Segmented
          label="Show"
          hideLabel
          value={filter}
          options={[
            { value: 'all', label: `All ${liked.length}` },
            { value: 'top', label: 'Tops' },
            { value: 'bottom', label: 'Bottoms' },
            { value: 'outer', label: 'Jackets' },
            { value: 'onepiece', label: 'Dresses' },
          ]}
          onChange={setFilter}
        />
      }
      ListEmptyComponent={
        <ThemedText variant="small" tone="muted">
          {`No liked ${FILTER_WORD[filter]} yet.`}
        </ThemedText>
      }
      renderItem={({ item: g }) => {
        const o = odds.get(g.id);
        const pick = o ? suggestedSize(o, g) : null;
        const size = pick?.size ?? null;
        const verdict = o && size ? verdictLine(o, size, g) : null;
        return (
          <Tile>
            <Pressable
              testID={`garment-tile-${g.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${g.brand} ${g.name}`}
              accessibilityValue={pick && verdict ? { text: `${sizeLine(pick.size, pick.recommended)}. ${verdict.headline}` } : undefined}
              onPress={() => onOpen(g, size ?? defaultSize(model, g, preference))}
              style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
              <View style={styles.icon}>
                <GarmentIcon garment={g} />
              </View>
              <Text style={tileText.brand}>{g.brand}</Text>
              <Text style={tileText.name}>{g.name}</Text>
              {pick && verdict ? (
                <>
                  <Text style={tileText.size}>{sizeLine(pick.size, pick.recommended)}</Text>
                  <Text style={[tileText.verdict, { color: toneColor[verdict.tone] }]}>{verdict.headline}</Text>
                </>
              ) : (
                // Bars the height of the two lines, so nothing jumps when they arrive.
                <View testID="tile-skeleton" style={styles.skeleton}>
                  <View style={[styles.bar, { width: '70%' }]} />
                  <View style={[styles.bar, { width: '55%' }]} />
                </View>
              )}
              <GarmentBadge garment={g} />
            </Pressable>
            <TileActions>
              <FoldersButton count={folderCount(g.id)} onPress={() => onFolders(g)} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unlike ${g.brand} ${g.name}`}
                onPress={() => onUnlike(g.id)}
                hitSlop={2}
                style={({ pressed }) => [styles.heart, pressed && styles.pressed]}>
                <Heart />
              </Pressable>
            </TileActions>
          </Tile>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: TILE_GAP, paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  row: { gap: TILE_GAP, alignItems: 'flex-start' },
  main: { alignItems: 'flex-start', gap: 2 },
  icon: { marginBottom: 6 },
  pressed: { opacity: 0.7 },
  // Two 19 pt lines (size line + verdict), 4 above and below as the text has.
  skeleton: { gap: 7, paddingTop: 10, paddingBottom: 10, width: '100%' },
  bar: { height: 12, borderRadius: 6, backgroundColor: colors.line },
  heart: { width: 44, height: 44, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 23, color: colors.ink, textAlign: 'center' },
  emptyText: { maxWidth: 300, textAlign: 'center' },
});
