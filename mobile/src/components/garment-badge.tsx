import { StyleSheet, Text, View } from 'react-native';
import type { Garment } from '@choudo/core/domain/garments';
import { garmentTag } from '@choudo/core/ui-logic/fitText';

import { colors, fonts, radius } from '@/theme';

/** "Sample data" for invented rows, otherwise how far to trust the numbers: "From size chart", … (styles.css .garment-tag). */
export function GarmentBadge({ garment }: { garment: Pick<Garment, 'source' | 'grade'> }) {
  const tag = garmentTag(garment);
  return (
    <View style={[styles.tag, styles[tag.kind]]}>
      <Text style={[styles.text, tag.kind === 'verified' && styles.verifiedText]} numberOfLines={1}>
        {tag.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  text: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.muted },
  // Dashed = not from a real chart.
  sample: { borderStyle: 'dashed', borderColor: colors.muted },
  estimated: { borderStyle: 'dashed', borderColor: colors.muted },
  verified: { borderColor: colors.ink },
  verifiedText: { color: colors.ink },
  unscored: { borderStyle: 'dotted', borderColor: colors.muted },
  charted: {},
});
