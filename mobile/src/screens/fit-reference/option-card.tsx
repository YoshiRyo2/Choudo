import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, fonts, radius, spacing } from '@/theme';

/** One choice in a list of radio cards: a tee, or a fit style. Selected = ink edge. */
export function OptionCard({
  title,
  subtitle,
  titleFirst = true,
  selected,
  onPress,
  leading,
}: {
  title: string;
  subtitle: string;
  /** Tees put the brand (subtitle) above the name; styles put the name first. */
  titleFirst?: boolean;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
}) {
  const name = <ThemedText style={styles.name}>{title}</ThemedText>;
  const sub = (
    <ThemedText variant="small" tone="muted">
      {subtitle}
    </ThemedText>
  );
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={titleFirst ? `${title}, ${subtitle}` : `${subtitle} ${title}`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}>
      {leading}
      <View style={styles.text}>
        {titleFirst ? name : sub}
        {titleFirst ? sub : name}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.m,
  },
  // 2.5 = the web's 1.5 border plus its 1 px inset ring.
  selected: { borderColor: colors.ink, borderWidth: 2.5, paddingVertical: 11, paddingHorizontal: 13 },
  pressed: { opacity: 0.7 },
  text: { flex: 1 },
  name: { fontFamily: fonts.bold },
});

/** Shared spacing for the steps. */
export const stepStyles = StyleSheet.create({
  form: { gap: 18 },
  list: { gap: spacing.sm },
  note: { marginTop: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
