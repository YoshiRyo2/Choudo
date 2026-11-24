import Svg, { Line, Path, Text } from 'react-native-svg';

import { colors, fonts } from '@/theme';

const WIDTH = 108;

/** A flat tee with the two tape lines to measure (the web's AnchorScreen drawing). Decorative. */
export function TeeDiagram() {
  return (
    <Svg
      testID="tee-diagram"
      width={WIDTH}
      height={(WIDTH * 110) / 120}
      viewBox="0 0 120 110"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Path
        d="M42 8 Q60 18 78 8 L104 20 L116 44 L98 52 L92 40 L92 104 L28 104 L28 40 L22 52 L4 44 L16 20 Z"
        fill={colors.surface}
        stroke={colors.ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Line x1={28} y1={46} x2={92} y2={46} stroke={colors.brand} strokeWidth={4} strokeLinecap="round" />
      <Line x1={45} y1={11} x2={45} y2={104} stroke={colors.brand} strokeWidth={4} strokeLinecap="round" />
      <Text x={70} y={41} textAnchor="middle" fontFamily={fonts.medium} fontSize={10} fill={colors.ink}>
        chest
      </Text>
      <Text x={50} y={80} fontFamily={fonts.medium} fontSize={10} fill={colors.ink}>
        length
      </Text>
    </Svg>
  );
}
