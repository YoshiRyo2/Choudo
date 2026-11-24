import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, fonts, radius } from '@/theme';

export type Step = 'choose' | 'catalogue' | 'measure' | 'style';

const CHOICES: { step: Exclude<Step, 'choose'>; title: string; hint: string; quiet?: boolean }[] = [
  { step: 'catalogue', title: 'Pick it from our tees', hint: 'If you own one we list, tell us the size' },
  { step: 'measure', title: 'Measure it', hint: 'Lay it flat, two numbers, a minute with a tape' },
  {
    step: 'style',
    title: 'Ask me a question instead',
    hint: 'One quick question about how you like tees to fit',
    quiet: true,
  },
];

/** The three ways in: a tee we list, a tee measured flat, or one quick question. */
export function ChooseStep({ onChoose }: { onChoose: (step: Exclude<Step, 'choose'>) => void }) {
  return (
    <View style={styles.choices}>
      {CHOICES.map((c) => (
        <Pressable
          key={c.step}
          accessibilityRole="button"
          accessibilityLabel={c.title}
          accessibilityHint={c.hint}
          onPress={() => onChoose(c.step)}
          style={({ pressed }) => [styles.choice, c.quiet && styles.quiet, pressed && styles.pressed]}>
          <ThemedText style={styles.title}>{c.title}</ThemedText>
          <ThemedText variant="small" tone="muted">
            {c.hint}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 10 },
  choice: {
    gap: 2,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.m,
  },
  quiet: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  pressed: { opacity: 0.7 },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
});
