import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { BodyModel } from '@choudo/core/domain/body';
import { outfitLine } from '@choudo/core/ui-logic/closetText';
import { nextOutfitName, outfitOf } from '@choudo/core/ui-logic/state/closet';
import type { Outfit, SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { FoldersButton } from '@/components/folders-button';
import { NameForm } from '@/components/name-form';
import { ThemedText } from '@/components/themed-text';
import { colors, fonts, radius, spacing } from '@/theme';

import { OutfitFigure } from './outfit-figure';
import { Tile, TILE_GAP, TileActions, tileText } from './tile';

export interface OutfitsProps {
  model: BodyModel;
  outfits: SavedOutfit[];
  /** What's on the mannequin in the Fitting room right now (resolved). */
  current: Outfit;
  onSave: (name: string) => void;
  onOpen: (outfit: Outfit) => void;
  onShare: (outfitId: string) => void;
  onDelete: (outfitId: string, name: string) => void;
  folderCount: (outfitId: string) => number;
  onFolders: (outfit: SavedOutfit) => void;
}

/** Outfits saved from the Fitting room (the web OutfitsTab), plus saving what's on now. */
export function Outfits({ model, outfits, current, onSave, onOpen, onShare, onDelete, folderCount, onFolders }: OutfitsProps) {
  return (
    <FlatList
      data={outfits}
      keyExtractor={(o) => o.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.card}>
            <ThemedText variant="small" tone="muted">
              In the fitting room now: <Text style={styles.now}>{outfitLine(current)}</Text>
            </ThemedText>
            <NameForm label="Save it as" submitLabel="Save outfit" placeholder={nextOutfitName(outfits)} allowBlank onSubmit={onSave} />
          </View>
          {outfits.length === 0 && (
            <ThemedText variant="small" tone="muted">
              No saved outfits yet. Put something together in the fitting room, then save it here.
            </ThemedText>
          )}
        </View>
      }
      renderItem={({ item: o }) => (
        <Tile>
          <OutfitFigure body={model.measurements} outfit={o} />
          <Text style={tileText.name} accessibilityRole="header">
            {o.name}
          </Text>
          <Text style={tileText.brand}>{outfitLine(o)}</Text>
          <TileActions>
            <Button size="sm" title="Open" onPress={() => onOpen(outfitOf(o))} />
            <FoldersButton count={folderCount(o.id)} onPress={() => onFolders(o)} />
            <Button size="sm" variant="quiet" title="Share" onPress={() => onShare(o.id)} />
            <Button size="sm" variant="quiet" title="Delete" onPress={() => onDelete(o.id, o.name)} />
          </TileActions>
        </Tile>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: TILE_GAP, paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  row: { gap: TILE_GAP, alignItems: 'flex-start' },
  header: { gap: 14 },
  // .closet__card: a white card with a line edge.
  card: { gap: 12, padding: 14, backgroundColor: colors.surface, borderRadius: radius.m, borderWidth: 1, borderColor: colors.line },
  now: { fontFamily: fonts.medium, color: colors.ink },
});
