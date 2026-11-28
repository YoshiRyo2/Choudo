import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BodyModel } from '@choudo/core/domain/body';
import { fitAllSizes, type PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { brandText, CHECK_TEXT, colourLabel, productBrand } from '@choudo/core/ui-logic/checkText';
import { fittingHeadline } from '@choudo/core/ui-logic/fitText';
import type { ReadyFetched } from '@choudo/core/ui-logic/state/fetched';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { middleSize } from '@choudo/core/ui-logic/state/outfit';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { FitAnswer } from '@/components/fit-answer';
import { GarmentIcon } from '@/components/garment-icon';
import { Mannequin } from '@/components/mannequin';
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
  /** Another of the product's colours: stored with the entry, so the preview and "Try it on" use it. */
  onColor: (colorCode: string) => void;
}

/**
 * One checked product: name and price; the brand's photo, large and as it is ("Photo: Uniqlo" / "Photo: Zara"),
 * beside Choudo's own drawing of it on you in the product's colour and cut; the answer for
 * the suggested size; a chip per colour and per size. Give it a `key` per garment so a new
 * product starts on its own suggested size.
 */
export function ResultCard({ fetched, model, preference, units, hasFitReference, onTryOn, onOpenProduct, onEditBody, onColor }: ResultCardProps) {
  const { garment, product } = fetched;
  const odds = useMemo(() => garmentOdds(model, garment, preference), [model, garment, preference]);
  const fits = useMemo(() => fitAllSizes(model, garment), [model, garment]);
  const [size, setSize] = useState(() => odds.recommended ?? middleSize(garment));
  const fit = fits.find((f) => f.sizeLabel === size);
  const face = fittingHeadline(odds, size, garment).tone;
  const colorName = product.colorName ? colourLabel(product.colorName) : null;
  const brand = brandText(productBrand(garment));

  return (
    <View style={styles.card} testID="check-result">
      <View style={styles.productText}>
        <ThemedText variant="small" tone="muted">
          {garment.brand}
        </ThemedText>
        <Text style={styles.name} accessibilityRole="header">
          {garment.name}
        </Text>
        <ThemedText variant="small">{[product.priceText, colorName, product.cutText].filter(Boolean).join(' · ')}</ThemedText>
      </View>

      <View style={styles.pictures}>
        <View style={styles.picture}>
          <View style={styles.frame}>
            <ProductPhoto garment={garment} uri={product.imageUrl} name={garment.name} credit={brand.photoCredit} />
          </View>
          <ThemedText variant="small" tone="muted" style={styles.caption}>
            {brand.photoCredit}
          </ThemedText>
        </View>
        <View style={styles.picture}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${CHECK_TEXT.onYou}: ${CHECK_TEXT.tryOn}, ${size}`}
            testID="check-preview"
            onPress={() => onTryOn(garment, size)}
            style={({ pressed }) => [styles.frame, styles.preview, pressed && styles.pressed]}>
            <Mannequin
              body={model.measurements}
              top={{ garment, sizeLabel: size, ...(fit ? { fit } : {}) }}
              showFit={false}
              frame="body"
              showHeightTape={false}
              face={face}
            />
          </Pressable>
          <ThemedText variant="small" tone="muted" style={styles.caption}>
            {CHECK_TEXT.onYou}
          </ThemedText>
        </View>
      </View>

      <FitAnswer
        garment={garment}
        size={size}
        odds={odds}
        details={{ fits, units, hasFitReference, bustFromBra: model.bra?.setsBust === true, onEditBody }}
      />

      {product.colors && product.colors.length > 1 && (
        <View style={styles.colours}>
          <ThemedText variant="small" tone="muted">
            {colorName ? `${CHECK_TEXT.colour}: ${colorName}` : CHECK_TEXT.colour}
          </ThemedText>
          <View accessibilityRole="radiogroup" accessibilityLabel={CHECK_TEXT.colour} style={styles.swatches}>
            {product.colors.map((c) => {
              const selected = c.code === product.colorCode;
              return (
                <Pressable
                  key={c.code}
                  accessibilityRole="radio"
                  accessibilityLabel={colourLabel(c.name)}
                  accessibilityState={{ selected, checked: selected }}
                  testID={`colour-${c.code}`}
                  hitSlop={6}
                  onPress={() => onColor(c.code)}
                  style={({ pressed }) => [styles.swatchRing, selected && styles.swatchSelected, pressed && styles.pressed]}>
                  <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <SizePicker fits={fits} selected={size} recommended={odds.recommended} odds={odds} onSelect={setSize} />

      {product.otherSleeve && (
        <ThemedText variant="small" tone="muted" testID="other-sleeve">
          {CHECK_TEXT.otherSleeve}
        </ThemedText>
      )}

      <View style={styles.actions}>
        <Button title={CHECK_TEXT.tryOn} onPress={() => onTryOn(garment, size)} />
        <Button variant="outline" title={brand.openAt} onPress={() => onOpenProduct(product.productUrl)} />
      </View>
    </View>
  );
}

/** The brand's photo as it is: fitted into its frame (contained, never cropped or recoloured); the flat drawing without one or on an error. */
function ProductPhoto({ garment, uri, name, credit }: { garment: Garment; uri: string | null; name: string; credit: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return <GarmentIcon garment={garment} />;
  return (
    <Image
      testID="check-photo"
      source={{ uri }}
      resizeMode="contain"
      style={styles.photo}
      accessibilityLabel={`${name}, ${credit}`}
      onError={() => setFailed(true)}
    />
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
  productText: { gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.ink },
  // The photo (3:4, as Uniqlo's) and the drawing side by side, the same height.
  pictures: { flexDirection: 'row', gap: 10 },
  picture: { flex: 1, gap: 4 },
  frame: {
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s,
    backgroundColor: colors.form,
    overflow: 'hidden',
  },
  preview: { backgroundColor: colors.peachTint },
  photo: { width: '100%', height: '100%' },
  caption: { textAlign: 'center' },
  colours: { gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // 36 pt rings (44 pt with the hit slop); the chip inside is the colour Choudo draws.
  swatchRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.ink },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.fieldEdge },
  actions: { gap: 10 },
  pressed: { opacity: 0.7 },
});
