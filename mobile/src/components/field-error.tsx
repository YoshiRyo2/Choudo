import { StyleSheet } from 'react-native';

import { fonts, spacing } from '@/theme';

import { ThemedText } from './themed-text';

/** A field's error in bold ink, read out when it appears. Nothing without a message. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <ThemedText variant="small" accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  error: { marginTop: spacing.xs + 2, fontFamily: fonts.bold },
});
