import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'quiet';
  size?: 'md' | 'sm';
  /**
   * Looks and is announced as unavailable, but a press still calls `onPress` (like the
   * web's aria-disabled), so the screen can say what's missing. Guard the action there.
   */
  disabled?: boolean;
  testID?: string;
  /** Fill the row (a sheet's main action) instead of hugging the label. */
  stretch?: boolean;
}

/** Choudo's pill button: primary = ink fill, outline = ink edge, quiet = underlined text. */
export function Button({ title, onPress, variant = 'primary', size = 'md', disabled = false, testID, stretch = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.small,
        stretch && styles.stretch,
        styles[variant],
        variant === 'primary' && disabled && styles.primaryDisabled,
        pressed && styles.pressed,
      ]}>
      <Text
        style={[
          styles.label,
          size === 'sm' && styles.smallLabel,
          variant === 'primary' ? styles.onInk : styles.onLight,
          variant === 'quiet' && styles.underline,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  small: { minHeight: 44, paddingHorizontal: 14 },
  stretch: { alignSelf: 'stretch' },
  primary: { backgroundColor: colors.ink },
  primaryDisabled: { backgroundColor: colors.inkDisabled },
  outline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink },
  quiet: { backgroundColor: 'transparent', paddingHorizontal: spacing.md - 4 },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
  smallLabel: { fontSize: 13, lineHeight: 17 },
  onInk: { color: colors.surface },
  onLight: { color: colors.ink },
  underline: { textDecorationLine: 'underline' },
});
