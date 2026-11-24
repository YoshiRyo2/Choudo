import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, spacing } from '@/theme';

/** A screen that isn't built yet: its title and one muted line. */
export function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <ThemedText variant="title" accessibilityRole="header">
        {title}
      </ThemedText>
      <ThemedText tone="muted" style={styles.line}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  line: { marginTop: spacing.sm, textAlign: 'center' },
});
