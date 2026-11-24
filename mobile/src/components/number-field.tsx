import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radius, spacing, type } from '@/theme';

import { ThemedText } from './themed-text';

export interface NumberFieldProps {
  label: string;
  unit: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  hint?: string;
  placeholder?: string;
  /** A red edge. The message itself goes in a FieldError under the field. */
  invalid?: boolean;
  /** The error text, read with the field while it's invalid (iOS has no aria-describedby). */
  error?: string;
  /** Show the label (and hint) above the box; otherwise the label is only read out. */
  showLabel?: boolean;
  autoFocus?: boolean;
  /** The box gets `${testID}-box`. */
  testID?: string;
}

/** A number box with its unit printed inside, like a gauge. Decimal pad; a comma is fine. */
export function NumberField({
  label,
  unit,
  value,
  onChangeText,
  onBlur,
  hint,
  placeholder,
  invalid,
  error,
  showLabel,
  autoFocus,
  testID,
}: NumberFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {showLabel && (
        <View style={styles.labelBlock}>
          <ThemedText>{label}</ThemedText>
          {hint && (
            <ThemedText variant="small" tone="muted">
              {hint}
            </ThemedText>
          )}
        </View>
      )}
      <View
        testID={testID && `${testID}-box`}
        style={[styles.box, focused && styles.focused, invalid && styles.invalid]}>
        <TextInput
          testID={testID}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
          autoComplete="off"
          autoCorrect={false}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          accessibilityHint={invalid && error ? error : hint}
        />
        <Text style={styles.unit} accessibilityElementsHidden importantForAccessibility="no">
          {unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, minWidth: 0 },
  labelBlock: { marginBottom: spacing.xs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200,
    minHeight: 48,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.fieldEdge,
    borderRadius: radius.s,
  },
  focused: { borderColor: colors.ink },
  // Thicker as well as red, so it never reads as focus.
  invalid: { borderColor: colors.fitBad, borderWidth: 2.5 },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
  },
  unit: { ...type.body, color: colors.muted, marginLeft: spacing.xs },
});
