import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BodyModel } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { canRetry, CHECK_TEXT, checkErrorText } from '@choudo/core/ui-logic/checkText';
import type { ReadyFetched } from '@choudo/core/ui-logic/state/fetched';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { GarmentIcon } from '@/components/garment-icon';
import { ThemedText } from '@/components/themed-text';
import type { CheckState } from '@/links/use-link-check';
import { colors, fonts, radius, spacing, type } from '@/theme';

import { ResultCard } from './result-card';

export interface CheckScreenProps {
  model: BodyModel;
  preference: PreferenceSpec;
  units: UnitSystem;
  hasFitReference: boolean;
  state: CheckState;
  /** The latest fetched products, newest first (at most RECENT_CHECKS). */
  recent: readonly ReadyFetched[];
  onCheck: (text: string) => void;
  onRetry: () => void;
  onOpenRecent: (garmentId: string) => void;
  /** Wear it in the Fitting room in this size, then go there. */
  onTryOn: (garment: Garment, size: string) => void;
  onOpenProduct: (url: string) => void;
  onEditBody: () => void;
  /** Test mode only: hosts of pasted links Choudo couldn't read. */
  unsupportedHosts?: readonly string[];
}

/**
 * The Check tab, where the app opens: paste a Uniqlo US product link, see the size to buy,
 * why, and how far to trust it. Loading and errors show inline, under the field.
 */
export function CheckScreen({
  model,
  preference,
  units,
  hasFitReference,
  state,
  recent,
  onCheck,
  onRetry,
  onOpenRecent,
  onTryOn,
  onOpenProduct,
  onEditBody,
  unsupportedHosts,
}: CheckScreenProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const loading = state.kind === 'loading';
  const submit = () => {
    if (!loading) onCheck(text);
  };
  const shownId = state.kind === 'result' ? state.fetched.garment.id : null;
  const others = recent.filter((r) => r.garment.id !== shownId);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Text style={styles.title} accessibilityRole="header">
        {CHECK_TEXT.title}
      </Text>

      <View style={styles.form}>
        <TextInput
          accessibilityLabel={CHECK_TEXT.field}
          placeholder={CHECK_TEXT.field}
          placeholderTextColor={colors.placeholder}
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          keyboardType="url"
          textContentType="URL"
          returnKeyType="go"
          onSubmitEditing={submit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, focused && styles.inputFocused]}
        />
        <Button title={CHECK_TEXT.submit} disabled={loading} onPress={submit} />
        <ThemedText variant="small" tone="muted">
          {CHECK_TEXT.scope}
        </ThemedText>
      </View>

      {state.kind === 'loading' && (
        <ThemedText accessibilityLiveRegion="polite" testID="check-loading">
          {CHECK_TEXT.loading}
        </ThemedText>
      )}

      {state.kind === 'error' && (
        <View style={styles.error} accessibilityLiveRegion="polite" testID="check-error">
          <ThemedText accessibilityRole="alert">{checkErrorText(state.error)}</ThemedText>
          {canRetry(state.error) && <Button size="sm" variant="outline" title={CHECK_TEXT.retry} onPress={onRetry} />}
        </View>
      )}

      {state.kind === 'result' && (
        <ResultCard
          key={state.fetched.garment.id}
          fetched={state.fetched}
          model={model}
          preference={preference}
          units={units}
          hasFitReference={hasFitReference}
          onTryOn={onTryOn}
          onOpenProduct={onOpenProduct}
          onEditBody={onEditBody}
        />
      )}

      {others.length > 0 && (
        <View style={styles.recent} testID="check-recent">
          <Text style={styles.heading} accessibilityRole="header">
            {CHECK_TEXT.recent}
          </Text>
          {others.map((r) => (
            <Pressable
              key={r.garment.id}
              accessibilityRole="button"
              accessibilityLabel={`${r.garment.brand} ${r.garment.name}`}
              onPress={() => onOpenRecent(r.garment.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.rowIcon}>
                <GarmentIcon garment={r.garment} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {r.garment.name}
                </Text>
                <ThemedText variant="small" tone="muted" numberOfLines={1}>
                  {r.product.priceText ? `${r.garment.brand} · ${r.product.priceText}` : r.garment.brand}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {unsupportedHosts && unsupportedHosts.length > 0 && (
        <ThemedText variant="small" tone="muted" testID="unsupported-hosts">
          {CHECK_TEXT.unsupportedHosts}: {unsupportedHosts.join(', ')}
        </ThemedText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: 20, paddingTop: 16, paddingHorizontal: spacing.md, paddingBottom: 40 },
  title: { ...type.title, fontSize: 26, lineHeight: 32 },
  form: { gap: 10 },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.fieldEdge,
    borderRadius: radius.s,
    backgroundColor: colors.surface,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.ink },
  error: { gap: 10, alignItems: 'flex-start' },
  recent: { gap: 8 },
  heading: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  rowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  pressed: { opacity: 0.7 },
});
