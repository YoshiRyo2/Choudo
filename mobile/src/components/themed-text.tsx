import { Text, type TextProps } from 'react-native';

import { colors, type, type TypeVariant } from '@/theme';

export type ThemedTextProps = TextProps & {
  variant?: TypeVariant;
  tone?: 'ink' | 'muted';
};

/** Text in Choudo's type scale. The caller's `style` goes last, so it wins. */
export function ThemedText({ variant = 'body', tone = 'ink', style, ...rest }: ThemedTextProps) {
  return <Text style={[type[variant], { color: colors[tone] }, style]} {...rest} />;
}
