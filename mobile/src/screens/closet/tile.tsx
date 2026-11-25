import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts, radius, spacing } from '@/theme';

/** Two tiles a row, spacing.md between them and at the screen edges. */
export const TILE_GAP = spacing.md;

/** A tile's width: half the screen less the gaps (so a lone last tile doesn't stretch). */
export function useTileWidth(): number {
  const { width } = useWindowDimensions();
  return (width - 3 * TILE_GAP) / 2;
}

/** The frame every Closet tile shares (Closet.css .tile): a white card with a line edge. */
export function Tile({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const width = useTileWidth();
  return <View style={[styles.tile, { width }, style]}>{children}</View>;
}

/** The row of small buttons at the foot of a tile. */
export function TileActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

/** The heart (Discover's Like, filled). */
export function Heart({ size = 22 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} accessible={false}>
      <Path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
        fill={colors.ink}
        stroke={colors.ink}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const tileText = StyleSheet.create({
  brand: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.muted },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19, color: colors.ink },
  size: { marginTop: 4, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.ink, fontVariant: ['tabular-nums'] },
  verdict: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, marginBottom: 4 },
});

const styles = StyleSheet.create({
  tile: {
    gap: 2,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 8 },
});
