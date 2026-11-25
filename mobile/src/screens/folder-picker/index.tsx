import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { isInFolder } from '@choudo/core/ui-logic/state/closet';
import type { Folder, FolderItem } from '@choudo/core/ui-logic/state/stored';

import { NameForm } from '@/components/name-form';
import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/theme';

export interface FolderPickerProps {
  /** What's being filed, e.g. "Slim Chino". */
  title: string;
  item: FolderItem;
  folders: Folder[];
  onToggle: (folderId: string) => void;
  onCreate: (name: string) => void;
}

/** Tick the folders an item belongs in, or make a new one for it (the web FolderPicker). */
export function FolderPicker({ title, item, folders, onToggle, onCreate }: FolderPickerProps) {
  return (
    <ScrollView style={styles.sheet} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View>
        <ThemedText variant="small" tone="muted">
          Folders
        </ThemedText>
        <ThemedText variant="title" accessibilityRole="header">
          {title}
        </ThemedText>
      </View>
      {folders.length > 0 ? (
        <View>
          {folders.map((f, i) => {
            const checked = isInFolder(f, item);
            return (
              <Pressable
                key={f.id}
                accessibilityRole="checkbox"
                accessibilityLabel={f.name}
                accessibilityState={{ checked }}
                onPress={() => onToggle(f.id)}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.pressed]}>
                <View style={[styles.box, checked && styles.boxChecked]}>
                  {checked && (
                    <Svg viewBox="0 0 20 20" width={14} height={14} accessible={false}>
                      <Path d="M4 10.5l4 4 8-9" fill="none" stroke={colors.surface} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </View>
                <ThemedText>{f.name}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ThemedText variant="small" tone="muted">
          No folders yet. Name one to put this in it.
        </ThemedText>
      )}
      <NameForm label="New folder" submitLabel="Create" placeholder="e.g. Work, Summer" onSubmit={onCreate} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.surface },
  content: { gap: 18, paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  // .folder-picker__row: 48 tall, a line between rows.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { opacity: 0.7 },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.s / 2,
    borderWidth: 1.5,
    borderColor: colors.fieldEdge,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.ink, borderColor: colors.ink },
});
