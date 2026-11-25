import { useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { estimateBody, validateBodyInput, type BodyInput, type BodyModel, type BodyType } from '@choudo/core/domain/body';
import { cmToIn, round } from '@choudo/core/domain/units';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import {
  braSizeProblemText,
  EMPTY_FORM,
  formToInput,
  inputToForm,
  OVERRIDE_FIELDS,
  switchUnits,
  type BodyForm,
  type OverrideField,
} from '@choudo/core/ui-logic/screens/bodyForm';
import {
  ALL_FIELDS,
  fieldErrors,
  forgetIfFixed,
  reveal,
  shownErrors,
  type FormField,
} from '@choudo/core/ui-logic/screens/bodyFieldErrors';

import { previewBody } from '@choudo/core/ui-logic/screens/bodyPreview';

import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Mannequin } from '@/components/mannequin';
import { NumberField } from '@/components/number-field';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { colors, fonts, radius, spacing } from '@/theme';

import { EstimateList } from './estimate-list';

export interface BodyScreenProps {
  initial: BodyInput | null;
  units: UnitSystem;
  onDone: (input: BodyInput, units: UnitSystem) => void;
  /** Present when there's a saved body to go back to. */
  onCancel?: () => void;
  /** Edit body only: the tee or style other tops are judged against. */
  fitReference?: FitReferenceProps;
  /** Edit body only: the hidden switch for the 10-person fit test. Shown in development only. */
  testMode?: { on: boolean; onChange: (on: boolean) => void };
  /** Open the About sheet. */
  onAbout?: () => void;
}

interface FitReferenceProps {
  line: string;
  isSet: boolean;
  /** Leave for the fit-reference step, passing the form's body if it's valid. */
  onChange: (input: BodyInput | null, units: UnitSystem) => void;
  onRemove: () => void;
}

const MISSING = 'Enter your height and weight to continue.';

const OVERRIDE_LABEL: Record<OverrideField, string> = {
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  inseam: 'Inseam',
};

const OVERRIDE_HINT: Record<OverrideField, string> = {
  chest: 'Fullest part, under the arms',
  waist: 'Where your trousers sit',
  hips: 'Fullest part of the seat',
  inseam: 'Crotch to floor, no shoes',
};

/** A women's body measures the full bust where a men's measures the chest. */
const overrideLabel = (field: OverrideField, bodyType: BodyType) =>
  field === 'chest' && bodyType === 'womens' ? 'Full bust' : OVERRIDE_LABEL[field];
const overrideHint = (field: OverrideField, bodyType: BodyType) =>
  field === 'chest' && bodyType === 'womens' ? 'Fullest part, tape level all round' : OVERRIDE_HINT[field];

/** "Your measurements": height and weight, optional tape numbers, and (editing) the fit reference. */
export function BodyScreen({ initial, units, onDone, onCancel, fitReference, testMode, onAbout }: BodyScreenProps) {
  const [form, setForm] = useState<BodyForm>(() => (initial ? inputToForm(initial, units) : { ...EMPTY_FORM, units }));
  const [showTape, setShowTape] = useState(() => Boolean(initial?.overrides));
  const [submitted, setSubmitted] = useState(false);
  // Fields whose error may show: each after it loses focus, all after a submit.
  const [revealed, setRevealed] = useState<ReadonlySet<FormField>>(() => new Set());

  const input = useMemo(() => formToInput(form), [form]);
  const braProblem = braSizeProblemText(form);
  const errors = useMemo(() => fieldErrors(form), [form]);
  const shown = shownErrors(errors, revealed);
  const model: BodyModel | null = useMemo(
    () => (input && validateBodyInput(input).length === 0 ? estimateBody(input) : null),
    [input],
  );
  const preview = useMemo(() => previewBody(model, form.bodyType), [model, form.bodyType]);

  const metric = form.units === 'metric';
  const lengthUnit = metric ? 'cm' : 'in';
  /** Typing into a field: its error hides as soon as it's right, and shows again only on blur. */
  const edit = (field: FormField, next: BodyForm) => {
    setForm(next);
    setRevealed((r) => forgetIfFixed(r, field, fieldErrors(next)));
  };
  const setOverride = (field: OverrideField, value: string) =>
    edit(field, { ...form, overrides: { ...form.overrides, [field]: value } });
  const blur = (field: FormField) => () => setRevealed((r) => reveal(r, [field]));

  const missing = !input;

  function submit() {
    setSubmitted(true);
    setRevealed((r) => reveal(r, ALL_FIELDS));
    if (input && model && !braProblem) {
      onDone(input, form.units);
      return;
    }
    // iOS has no live regions: say what's wrong out loud.
    const first = ALL_FIELDS.map((f) => errors[f]).find(Boolean);
    AccessibilityInfo.announceForAccessibility(missing ? MISSING : (first ?? MISSING));
  }

  /** Our estimate for a field, in the form's units — shown as the placeholder. */
  const estimate = (field: OverrideField) => {
    if (!model) return '';
    const cm = model.measurements[`${field}Cm` as const];
    return String(round(metric ? cm : cmToIn(cm), metric ? 0 : 1));
  };

  const fieldProps = (field: FormField) => ({
    onBlur: blur(field),
    invalid: Boolean(shown[field]),
    error: shown[field],
  });

  return (
    <ScrollView
      testID="body-scroll"
      style={styles.scroll}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      <View>
        <Wordmark />
        <ThemedText variant="title" accessibilityRole="header" style={styles.heading}>
          Your measurements
        </ThemedText>
        <ThemedText tone="muted" style={styles.lede}>
          Height and weight are enough to start. We’ll compare them with each brand’s size chart.
        </ThemedText>
      </View>

      <Segmented
        label="Units"
        value={form.units}
        options={[
          { value: 'metric', label: 'cm, kg' },
          { value: 'imperial', label: 'ft, lb' },
        ]}
        onChange={(u) => setForm((f) => switchUnits(f, u))}
      />
      <Segmented
        label="Size me in"
        value={form.bodyType}
        options={[
          { value: 'womens', label: 'Women’s clothes' },
          { value: 'mens', label: 'Men’s clothes' },
        ]}
        onChange={(bodyType) => setForm((f) => ({ ...f, bodyType }))}
      />

      <View>
        <ThemedText style={styles.legend}>Height</ThemedText>
        {metric ? (
          <NumberField
            label="Height"
            unit="cm"
            value={form.heightCm}
            onChangeText={(heightCm) => edit('height', { ...form, heightCm })}
            autoFocus={!initial}
            {...fieldProps('height')}
          />
        ) : (
          <View style={styles.pair}>
            <NumberField
              label="Feet"
              unit="ft"
              value={form.heightFt}
              onChangeText={(heightFt) => edit('height', { ...form, heightFt })}
              autoFocus={!initial}
              {...fieldProps('height')}
            />
            <NumberField
              label="Inches"
              unit="in"
              value={form.heightIn}
              onChangeText={(heightIn) => edit('height', { ...form, heightIn })}
              {...fieldProps('height')}
            />
          </View>
        )}
        <FieldError message={shown.height} />
      </View>

      <View>
        <ThemedText style={styles.legend}>Weight</ThemedText>
        <NumberField
          label="Weight"
          unit={metric ? 'kg' : 'lb'}
          value={form.weight}
          onChangeText={(weight) => edit('weight', { ...form, weight })}
          {...fieldProps('weight')}
        />
        <FieldError message={shown.weight} />
      </View>

      <View style={styles.tape}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Have a tape measure? Add your own numbers"
          accessibilityState={{ expanded: showTape }}
          onPress={() => setShowTape((s) => !s)}
          style={({ pressed }) => [styles.tapeToggle, pressed && styles.pressed]}>
          <ThemedText style={styles.tapeToggleText}>Have a tape measure? Add your own numbers</ThemedText>
          {/* Drawn, not ⌃ / ⌄: the app's font has neither, so they'd show in the system font. */}
          <View style={[styles.chevron, showTape ? styles.chevronUp : styles.chevronDown]} />
        </Pressable>
        {showTape && (
          <View style={styles.tapeBody}>
            <ThemedText variant="small" tone="muted">
              Leave any blank to use our estimate (shown in grey). Measure over light clothing, tape snug but not
              tight.
            </ThemedText>
            <View style={styles.grid}>
              {OVERRIDE_FIELDS.map((field) => (
                <View key={field} style={styles.gridItem}>
                  <NumberField
                    label={overrideLabel(field, form.bodyType)}
                    hint={overrideHint(field, form.bodyType)}
                    unit={lengthUnit}
                    value={form.overrides[field]}
                    placeholder={estimate(field)}
                    onChangeText={(v) => setOverride(field, v)}
                    showLabel
                    {...fieldProps(field)}
                  />
                  <FieldError message={shown[field]} />
                </View>
              ))}
            </View>
            {form.bodyType === 'womens' && (
              <View style={styles.bra}>
                <NumberField
                  label="Bra size"
                  hint="Optional. Used for your bust if Full bust is blank"
                  value={form.braSize}
                  placeholder="34C"
                  onChangeText={(braSize) => edit('braSize', { ...form, braSize })}
                  keyboardType="default"
                  autoCapitalize="characters"
                  showLabel
                  {...fieldProps('braSize')}
                />
                <Segmented
                  label="Cup letters"
                  value={form.braSystem}
                  options={[
                    { value: 'us', label: 'US' },
                    { value: 'uk', label: 'UK' },
                  ]}
                  onChange={(braSystem) => edit('braSize', { ...form, braSystem })}
                />
                <FieldError message={shown.braSize} />
              </View>
            )}
          </View>
        )}
      </View>

      {fitReference && (
        <View style={styles.fitRef}>
          <ThemedText style={styles.fitRefTitle} accessibilityRole="header">
            Your fit reference
          </ThemedText>
          <ThemedText tone="muted">{fitReference.line}</ThemedText>
          <View style={styles.row}>
            <Button
              variant="outline"
              size="sm"
              title={fitReference.isSet ? 'Change' : 'Add a tee you like'}
              onPress={() => fitReference.onChange(model ? input : null, form.units)}
            />
            {fitReference.isSet && (
              <Button variant="quiet" size="sm" title="Remove" onPress={fitReference.onRemove} />
            )}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.row}>
          {/* Stays ink while height or weight is missing: tapping it says what's needed. */}
          <Button title={initial ? 'Save and go to fitting room' : 'Go to fitting room'} onPress={submit} />
          {onCancel && <Button variant="quiet" title="Cancel" onPress={onCancel} />}
        </View>
        {submitted && missing && <FieldError message={MISSING} />}
      </View>

      <View style={styles.privacy}>
        <ThemedText variant="small" tone="muted">
          Saved on this device only. No account, no photos, nothing sent anywhere.
        </ThemedText>
        {onAbout && <Button variant="quiet" size="sm" title="About Choudo" onPress={onAbout} />}
      </View>

      {__DEV__ && testMode && (
        <View style={styles.testers}>
          <ThemedText variant="small" tone="muted">
            For fit testers
          </ThemedText>
          <View style={styles.switchRow}>
            <Switch
              value={testMode.on}
              onValueChange={testMode.onChange}
              trackColor={{ true: colors.ink }}
              accessibilityLabel="Test mode: record how clothes really fit, and download the results"
            />
            <ThemedText variant="small" style={styles.switchLabel}>
              Test mode: record how clothes really fit, and download the results
            </ThemedText>
          </View>
        </View>
      )}

      <View style={styles.preview}>
        <View
          style={styles.figure}
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            preview.isDefault ? 'Mannequin preview, a typical body until you enter yours' : 'Mannequin preview of your body'
          }>
          <Mannequin body={preview.body} showFit={false} />
        </View>
        {model ? (
          <EstimateList model={model} units={form.units} />
        ) : (
          <ThemedText variant="small" tone="muted" style={styles.caption}>
            Enter your height and weight to size it to you.
          </ThemedText>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { gap: 22, paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: 40 },
  heading: { marginTop: 18 },
  lede: { marginTop: spacing.sm },
  legend: { fontFamily: fonts.bold, marginBottom: 6 },
  pair: { flexDirection: 'row', gap: 10 },
  tape: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  tapeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
    paddingVertical: 14,
  },
  tapeToggleText: { flex: 1 },
  chevron: { width: 9, height: 9, marginHorizontal: 4, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.ink },
  chevronDown: { transform: [{ translateY: -2 }, { rotate: '45deg' }] },
  chevronUp: { transform: [{ translateY: 2 }, { rotate: '-135deg' }] },
  pressed: { opacity: 0.7 },
  tapeBody: { paddingBottom: 18, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { flexBasis: '45%', flexGrow: 1 },
  bra: { gap: 12, marginTop: 2 },
  fitRef: { gap: 6, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.line },
  fitRefTitle: { fontFamily: fonts.bold },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.xs },
  privacy: { gap: 0 },
  testers: { gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchLabel: { flex: 1 },
  preview: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
  },
  figure: { flex: 1, height: 360 },
  caption: { maxWidth: 110 },
});
