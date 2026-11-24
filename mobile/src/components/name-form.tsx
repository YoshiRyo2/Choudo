import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { MAX_NAME_LENGTH } from '@choudo/core/ui-logic/state/closet';

import { colors, fonts, radius } from '@/theme';

import { Button } from './button';
import { ThemedText } from './themed-text';

export interface NameFormProps {
  label: string;
  submitLabel: string;
  initial?: string;
  placeholder?: string;
  /** Allow saving with an empty box (the caller fills in a default name). */
  allowBlank?: boolean;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

/** One text box and a button, for naming folders and outfits (the web NameForm). Return submits. */
export function NameForm({ label, submitLabel, initial = '', placeholder, allowBlank, onSubmit, onCancel, autoFocus }: NameFormProps) {
  const [name, setName] = useState(initial);
  const [focused, setFocused] = useState(false);
  const blank = name.trim() === '';

  const submit = () => {
    if (blank && !allowBlank) return;
    onSubmit(name);
    setName('');
  };

  return (
    <View style={styles.form}>
      <ThemedText variant="small" tone="muted" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </ThemedText>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={label}
          value={name}
          onChangeText={setName}
          maxLength={MAX_NAME_LENGTH}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={submit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, focused && styles.inputFocused]}
        />
        <Button size="sm" title={submitLabel} disabled={blank && !allowBlank} onPress={submit} />
        {onCancel && <Button size="sm" variant="quiet" title="Cancel" onPress={onCancel} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.fieldEdge,
    borderRadius: radius.s,
    backgroundColor: colors.surface,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.ink },
});
