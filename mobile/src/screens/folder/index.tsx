import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BodyModel } from '@choudo/core/domain/body';
import type { Garment } from '@choudo/core/domain/garments';
import { outfitLine } from '@choudo/core/ui-logic/closetText';
import { outfitOf, shownFolderItems } from '@choudo/core/ui-logic/state/closet';
import type { Folder, FolderItem, Outfit, SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { GarmentIcon } from '@/components/garment-icon';
import { NameForm } from '@/components/name-form';
import { ThemedText } from '@/components/themed-text';
import { colors, spacing } from '@/theme';

import { OutfitFigure } from '../closet/outfit-figure';
import { Tile, TILE_GAP, TileActions, tileText } from '../closet/tile';

export interface FolderScreenProps {
  folder: Folder;
  model: BodyModel;
  /** Every garment the app may show: items that point elsewhere (a sample in a store build) are skipped. */
  garments: readonly Garment[];
  outfits: SavedOutfit[];
  /** Show the "Folder name" form in place of the list's header. */
  renaming: boolean;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onRemove: (item: FolderItem) => void;
  onOpenGarment: (garment: Garment) => void;
  onOpenOutfit: (outfit: Outfit) => void;
}

type Entry = { key: string; item: FolderItem } & ({ garment: Garment } | { outfit: SavedOutfit });

/** One folder's garments and outfits (the web FolderView); its name, Rename and Delete are in the header. */
export function FolderScreen({ folder, model, garments, outfits, renaming, onRename, onCancelRename, onRemove, onOpenGarment, onOpenOutfit }: FolderScreenProps) {
  // Items that are gone (a garment left the catalogue, an outfit deleted) or hidden (a sample in a
  // store build, or an outfit wearing one) are skipped; the folder keeps them stored.
  const entries = shownFolderItems(folder, outfits, garments).flatMap((item): Entry[] => {
    if (item.kind === 'garment') {
      const garment = garments.find((g) => g.id === item.id);
      return garment ? [{ key: `g-${item.id}`, item, garment }] : [];
    }
    const outfit = outfits.find((o) => o.id === item.id);
    return outfit ? [{ key: `o-${item.id}`, item, outfit }] : [];
  });

  return (
    <FlatList
      style={styles.screen}
      data={entries}
      keyExtractor={(e) => e.key}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        renaming ? (
          <NameForm label="Folder name" submitLabel="Rename" initial={folder.name} autoFocus onSubmit={onRename} onCancel={onCancelRename} />
        ) : undefined
      }
      ListEmptyComponent={
        <ThemedText variant="small" tone="muted">
          Nothing here yet. Use “Add to folder” on a liked garment or a saved outfit.
        </ThemedText>
      }
      renderItem={({ item: e }) => {
        const remove = <Button size="sm" variant="quiet" title="Remove" onPress={() => onRemove(e.item)} />;
        if ('garment' in e) {
          const g = e.garment;
          return (
            <Tile>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${g.brand} ${g.name}`}
                onPress={() => onOpenGarment(g)}
                style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
                <View style={styles.icon}>
                  <GarmentIcon garment={g} />
                </View>
                <Text style={tileText.brand}>{g.brand}</Text>
                <Text style={tileText.name}>{g.name}</Text>
              </Pressable>
              <TileActions>{remove}</TileActions>
            </Tile>
          );
        }
        const o = e.outfit;
        return (
          <Tile>
            <OutfitFigure body={model.measurements} outfit={o} garments={garments} />
            <Text style={tileText.name} accessibilityRole="header">
              {o.name}
            </Text>
            <Text style={tileText.brand}>{outfitLine(o, garments)}</Text>
            <TileActions>
              <Button size="sm" title="Open" onPress={() => onOpenOutfit(outfitOf(o))} />
              {remove}
            </TileActions>
          </Tile>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { gap: TILE_GAP, padding: spacing.md },
  row: { gap: TILE_GAP, alignItems: 'flex-start' },
  main: { alignItems: 'flex-start', gap: 2 },
  icon: { marginBottom: 6 },
  pressed: { opacity: 0.7 },
});
