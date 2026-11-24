import { useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import type { Anchor } from '@choudo/core/domain/fit';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import { anchorToTeeForm, teeFormToAnchor, type MeasuredTeeForm } from '@choudo/core/ui-logic/screens/anchorForm';

import { FieldError } from '@/components/field-error';
import { NumberField } from '@/components/number-field';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/theme';

import { stepStyles } from './option-card';
import { StepActions } from './step-actions';
import { TeeDiagram } from './tee-diagram';

const MISSING = 'Enter both numbers to continue.';

/** "Measure your tee": chest width and length, laid flat. */
export function MeasureStep({
  units,
  initial,
  onSave,
  onBack,
}: {
  units: UnitSystem;
  initial: Anchor | null;
  onSave: (anchor: Anchor) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<MeasuredTeeForm>(() => anchorToTeeForm(initial, units));
  const [submitted, setSubmitted] = useState(false);
  const result = useMemo(() => teeFormToAnchor(form, units), [form, units]);
  const unit = units === 'metric' ? 'cm' : 'in';

  function submit() {
    setSubmitted(true);
    if (result.anchor) {
      onSave(result.anchor);
      return;
    }
    // iOS has no live regions: say what's wrong out loud.
    AccessibilityInfo.announceForAccessibility(
      result.missing ? MISSING : (result.errors.chest ?? result.errors.length ?? MISSING),
    );
  }

  return (
    <View style={stepStyles.form}>
      <View style={styles.howto}>
        <TeeDiagram />
        <ThemedText variant="small" tone="muted" style={styles.howtoText}>
          Lay the tee flat on a table, front up, and smooth it out. Measure straight, tape flat but not pulled.
        </ThemedText>
      </View>
      <View style={styles.fields}>
        <View>
          <NumberField
            label="Chest width"
            hint="Straight across, armpit to armpit"
            unit={unit}
            value={form.chest}
            onChangeText={(chest) => setForm((f) => ({ ...f, chest }))}
            invalid={Boolean(result.errors.chest)}
            error={result.errors.chest}
            showLabel
            autoFocus
          />
          <FieldError message={result.errors.chest} />
        </View>
        <View>
          <NumberField
            label="Length"
            hint="Highest point of the shoulder, by the collar, down to the hem"
            unit={unit}
            value={form.length}
            onChangeText={(length) => setForm((f) => ({ ...f, length }))}
            invalid={Boolean(result.errors.length)}
            error={result.errors.length}
            showLabel
          />
          <FieldError message={result.errors.length} />
        </View>
      </View>
      {submitted && result.missing && <FieldError message={MISSING} />}
      <StepActions canSave={result.anchor !== null} onSave={submit} onBack={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  howto: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  howtoText: { flex: 1 },
  fields: { gap: spacing.md },
});
