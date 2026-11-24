import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';

import { ThemedText } from './themed-text';

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Keep the label for VoiceOver only (the web's hideLabel), e.g. a cm / in switch in a header. */
  hideLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A row of mutually exclusive choices: iOS's own segmented control, its label above. */
export function Segmented<T extends string>({ label, value, options, onChange, hideLabel = false, style }: SegmentedProps<T>) {
  return (
    <View style={style}>
      {!hideLabel && (
        <ThemedText variant="small" tone="muted" style={styles.label}>
          {label}
        </ThemedText>
      )}
      <SegmentedControl
        values={options.map((o) => o.label)}
        selectedIndex={options.findIndex((o) => o.value === value)}
        onChange={({ nativeEvent }) => {
          const next = options[nativeEvent.selectedSegmentIndex];
          if (next && next.value !== value) onChange(next.value);
        }}
        accessibilityLabel={label}
        appearance="light"
        tintColor={colors.surface}
        style={styles.control}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs + 2 },
  control: { alignSelf: 'stretch' },
});
