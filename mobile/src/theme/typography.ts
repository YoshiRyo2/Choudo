import type { TextStyle } from 'react-native';

import { colors } from './colors';

/** M PLUS Rounded 1c, loaded with useFonts in app/_layout.tsx (only these three weights ship). */
export const fonts = {
  medium: 'MPLUSRounded1c_500Medium',
  bold: 'MPLUSRounded1c_700Bold',
  extraBold: 'MPLUSRounded1c_800ExtraBold',
} as const;

/** The type scale from styles.css: headline 42/800, title 22/800, body 16/500, small 13/500. */
export const type = {
  headline: { fontFamily: fonts.extraBold, fontSize: 42, lineHeight: 46, color: colors.ink },
  title: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, color: colors.ink },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.ink },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
