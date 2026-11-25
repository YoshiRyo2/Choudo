import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BodyType } from '@choudo/core/domain/body';
import type { GarmentFit } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { zoneName } from '@choudo/core/ui-logic/fitText';
import { answersFor, testQuestions, type PickedAnswers, type TesterAnswers } from '@choudo/core/ui-logic/state/fitTests';
import { CHEST_ANSWERS, LENGTH_ANSWERS, type FitTestRecord, type GirthAnswer, type LengthAnswer } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { colors, fonts, radius } from '@/theme';

export interface FitTestPanelProps {
  /** The garment on show, or null when none is on. */
  garment: Garment | null;
  size: string | null;
  /** How that size fits: decides whether the thigh (or a dress's waist) is asked. */
  fit: GarmentFit | null;
  records: readonly unknown[];
  onSave: (answers: TesterAnswers) => void;
  onClear: () => void;
  /** Hand the results to the share sheet as a CSV. */
  onExport: () => void;
  /** The chest question says "Bust" for a women's body. */
  bodyType: BodyType;
}

const GIRTH_TEXT: Record<GirthAnswer, string> = { 'too-tight': 'Too tight', 'just-right': 'Just right', 'too-loose': 'Too loose' };
const LENGTH_TEXT: Record<LengthAnswer, string> = { 'too-short': 'Too short', 'just-right': 'Just right', 'too-long': 'Too long' };
const NONE = '__none__';
const EMPTY: PickedAnswers = { chest: null, waist: null, thigh: null, length: null };

/**
 * Test mode (the web FitTestPanel): record how the garment on the mannequin really fits the
 * tester. Development and fit-test (preview) builds only. The Fitting room keys it on the
 * garment and size, so a new pick starts a fresh form.
 */
export function FitTestPanel({ garment, size, fit, records, onSave, onClear, onExport, bodyType }: FitTestPanelProps) {
  const [tester, setTester] = useState(() => (records.at(-1) as FitTestRecord | undefined)?.tester ?? '');
  const [picked, setPicked] = useState<PickedAnswers>(EMPTY);
  const [kept, setKept] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const questions = garment && fit ? testQuestions(fit, garment) : [];
  const answers = answersFor(questions, picked, tester, kept === null ? undefined : kept === NONE ? null : kept);
  const pick = (q: keyof PickedAnswers) => (v: string) => {
    setPicked((p) => ({ ...p, [q]: v }));
    setSaved(false);
  };

  function save() {
    if (!answers) return;
    onSave(answers);
    setPicked(EMPTY);
    setKept(null);
    setSaved(true);
  }

  const lengthLegend = fit?.zones.some((z) => z.zone === 'inseam')
    ? zoneName('inseam', bodyType)
    : garment?.category === 'outer'
      ? zoneName('sleeve', bodyType)
      : 'Length';

  return (
    <View style={styles.panel}>
      <Text style={styles.title} accessibilityRole="header">
        Test mode
      </Text>
      {garment && size ? (
        <View style={styles.form}>
          <ThemedText>
            How does the {garment.brand} {garment.name} in <Text style={styles.size}>{size}</Text> really fit?
          </ThemedText>
          <View style={styles.tester}>
            <ThemedText style={styles.legend}>Tester</ThemedText>
            <TextInput
              accessibilityLabel="Tester"
              value={tester}
              onChangeText={(t) => {
                setTester(t);
                setSaved(false);
              }}
              placeholder="e.g. T03"
              placeholderTextColor={colors.placeholder}
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="characters"
              style={styles.input}
            />
          </View>
          {questions.map((q) =>
            q === 'length' ? (
              <Choices key={q} legend={lengthLegend} options={LENGTH_ANSWERS.map((a) => [a, LENGTH_TEXT[a]])} value={picked.length} onChange={pick('length')} />
            ) : (
              <Choices key={q} legend={zoneName(q, bodyType)} options={CHEST_ANSWERS.map((a) => [a, GIRTH_TEXT[a]])} value={picked[q]} onChange={pick(q)} />
            ),
          )}
          <Choices
            legend="Which size would they keep?"
            options={[...garment.sizes.map((s) => [s.label, s.label] as [string, string]), [NONE, 'None']]}
            value={kept}
            onChange={(v) => {
              setKept(v);
              setSaved(false);
            }}
          />
          <View style={styles.row}>
            <Button size="sm" title="Save result" disabled={!answers} onPress={save} />
            {saved && (
              <ThemedText accessibilityLiveRegion="polite" accessibilityRole="text">
                Saved.
              </ThemedText>
            )}
          </View>
        </View>
      ) : (
        <ThemedText>Put a garment on the mannequin to record how it really fits.</ThemedText>
      )}
      <View style={styles.row}>
        <ThemedText variant="small" tone="muted" style={styles.count}>
          {`${records.length} ${records.length === 1 ? 'result' : 'results'} saved on this device`}
        </ThemedText>
        {records.length > 0 && (
          <>
            <Button size="sm" variant="outline" title="Export CSV" onPress={onExport} />
            <Button
              size="sm"
              variant="quiet"
              title={clearing ? 'Tap again to clear all' : 'Clear'}
              onPress={() => {
                if (!clearing) return setClearing(true);
                setClearing(false);
                onClear();
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

function Choices<T extends string>({ legend, options, value, onChange }: { legend: string; options: [T, string][]; value: T | null; onChange: (value: T) => void }) {
  return (
    <View style={styles.choices}>
      <ThemedText style={styles.legend}>{legend}</ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map(([v, text]) => {
          const selected = v === value;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityLabel={`${legend}: ${text}`}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(v)}
              hitSlop={4}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // FitTestPanel.css: a dashed ink frame, so it never passes for part of the app.
  panel: { gap: 12, padding: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: radius.m, backgroundColor: colors.surface },
  title: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 24, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink },
  form: { gap: 12 },
  size: { fontFamily: fonts.bold, fontVariant: ['tabular-nums'] },
  tester: { gap: 4 },
  legend: { fontFamily: fonts.bold },
  input: {
    maxWidth: 160,
    height: 40,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.s,
    backgroundColor: colors.bg,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  choices: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.pill },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.ink },
  chipTextSelected: { color: colors.surface },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  count: { fontVariant: ['tabular-nums'] },
});
