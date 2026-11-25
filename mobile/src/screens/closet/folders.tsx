import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { folderSummary } from '@choudo/core/ui-logic/state/closet';
import type { Folder } from '@choudo/core/ui-logic/state/stored';

import { NameForm } from '@/components/name-form';
import { ThemedText } from '@/components/themed-text';
import { colors, fonts, radius, spacing } from '@/theme';

export interface FoldersProps {
  folders: Folder[];
  onCreate: (name: string) => void;
  onOpenFolder: (folderId: string) => void;
}

/** Named folders of liked garments and saved outfits (the web FoldersTab's list). */
export function Folders({ folders, onCreate, onOpenFolder }: FoldersProps) {
  return (
    <ScrollView contentContainerStyle={styles.section} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.card}>
        <NameForm label="New folder" submitLabel="Create" placeholder="e.g. Work, Summer" onSubmit={onCreate} />
      </View>
      {folders.length === 0 ? (
        <ThemedText variant="small" tone="muted">
          No folders yet. Make one here, then use “Add to folder” on a liked garment or a saved outfit.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {folders.map((f, i) => {
            const summary = folderSummary(f);
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityLabel={`${f.name}, ${summary}`}
                onPress={() => onOpenFolder(f.id)}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.pressed]}>
                <Text style={styles.name} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={styles.count}>{summary}</Text>
                <View style={styles.chevron} />
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14, paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  card: { gap: 12, padding: 14, backgroundColor: colors.surface, borderRadius: radius.m, borderWidth: 1, borderColor: colors.line },
  // .folder-list: one white card, a line between rows 56 tall.
  list: { backgroundColor: colors.surface, borderRadius: radius.m, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.form },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.ink },
  count: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.muted },
  chevron: { width: 8, height: 8, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.muted, transform: [{ rotate: '-45deg' }] },
});
