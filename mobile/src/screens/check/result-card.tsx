import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { BodyModel } from '@choudo/core/domain/body';
import { fitAllSizes, type PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { CHECK_TEXT } from '@choudo/core/ui-logic/checkText';
import type { ReadyFetched } from '@choudo/core/ui-logic/state/fetched';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { middleSize } from '@choudo/core/ui-logic/state/outfit';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { FitAnswer } from '@/components/fit-answer';
import { GarmentIcon } from '@/components/garment-icon';
import { SizePicker } from '@/components/size-picker';
import { ThemedText } from '@/components/themed-text';
import { colors, fonts, radius } from '@/theme';

export interface ResultCardProps {
  fetched: ReadyFetched;
  model: BodyModel;
  preference: PreferenceSpec;
  units: UnitSystem;
  hasFitReference: boolean;
  onTryOn: (garment: Garment, size: string) => void;
  onOpenProduct: (url: string) => void;
  onEditBody: () => void;
}

/**
 * One checked product: name, price and the brand's photo as it is (a thumbnail, never on
 * the mannequin), the answer for the suggested size, and a chip per size to see another.
 * Give it a `key` per garment so a new product starts on its own suggested size.
 */
export function ResultCard({ fetched, model, preference, units, hasFitReference, onTryOn, onOpenProduct, onEditBody }: ResultCardProps) {
  const { garment, product } = fetched;
  const odds = useMemo(() => garmentOdds(model, garment, preference), [model, garment, preference]);
  const fits = useMemo(() => fitAllSizes(model, garment), [model, garment]);
  const [size, setSize] = useState(() => odds.recommended ?? middleSize(garment));

  return (
    <View style={styles.card} testID="check-result">
      <View style={styles.product}>
        <Thumb garment={garment} uri={product.imageUrl} />
        <View style={styles.productText}>
          <ThemedText variant="small" tone="muted">
            {garment.brand}
          </ThemedText>
          <Text style={styles.name} accessibilityRole="header">
            {garment.name}
          </Text>
          {product.priceText && <ThemedText variant="small">{product.priceText}</ThemedText>}
        </View>
      </View>

      <FitAnswer
        garment={garment}
        size={size}
        odds={odds}
        details={{ fits, units, hasFitReference, bustFromBra: model.bra?.setsBust === true, onEditBody }}
      />

      <SizePicker fits={fits} selected={size} recommended={odds.recommended} odds={odds} onSelect={setSize} />

      <View style={styles.actions}>
        <Button title={CHECK_TEXT.tryOn} onPress={() => onTryOn(garment, size)} />
        <Button variant="outline" title={CHECK_TEXT.openAt} onPress={() => onOpenProduct(product.productUrl)} />
      </View>
    </View>
  );
}

/** The brand's product photo, shown as it is (contained, never cropped); the flat drawing without one or on an error. */
function Thumb({ garment, uri }: { garment: Garment; uri: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.thumb}>
      {uri && !failed ? (
        <Image
          testID="check-thumb"
          source={{ uri }}
          resizeMode="contain"
          style={styles.thumbImage}
          accessible={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <GarmentIcon garment={garment} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  product: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 72, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: radius.s, backgroundColor: colors.form, overflow: 'hidden' },
  thumbImage: { width: 72, height: 96 },
  productText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.ink },
  actions: { gap: 10 },
});
