import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { PixelRatio, ScrollView, StyleSheet, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import type { Garment } from '@choudo/core/domain/garments';
import type { HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import type { SavedOutfit } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/theme';

import { CARD_HEIGHT, CARD_WIDTH, ShareCard } from './share-card';

export interface ShareOutfitProps {
  outfit: SavedOutfit;
  body: BodyMeasurements;
  head: HeadKind;
  /** Every garment the app may show (useGarments). */
  garments: readonly Garment[];
}

/** The picture: 1080 × 1350 px, 4:5 (3× the card). */
const IMAGE_PX = { width: CARD_WIDTH * 3, height: CARD_HEIGHT * 3 };

/** Share a saved outfit as a picture: the card as a preview, then the iOS share sheet. */
export function ShareOutfit({ outfit, body, head, garments }: ShareOutfitProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const card = useRef<ViewInstance>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    Sharing.isAvailableAsync().then(
      (yes) => live && setAvailable(yes),
      () => live && setAvailable(false),
    );
    return () => {
      live = false;
    };
  }, []);

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      // iOS takes the size in points and draws at the screen's scale, so divide by it.
      const scale = PixelRatio.get();
      const uri = await captureRef(card, { format: 'png', quality: 1, width: IMAGE_PX.width / scale, height: IMAGE_PX.height / scale });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: outfit.name });
    } catch {
      // A cancel resolves; this is a capture or share-sheet failure, which has no wording yet.
    } finally {
      setBusy(false);
    }
  }

  // The preview fits the sheet; the card itself keeps its size, so the picture is the same.
  const scale = Math.min(1, (width - 2 * spacing.md) / CARD_WIDTH);

  return (
    <View style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText variant="title" accessibilityRole="header">
          Share outfit
        </ThemedText>
        <View style={[styles.preview, { width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }]}>
          <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
            <ShareCard ref={card} outfit={outfit} body={body} head={head} garments={garments} />
          </View>
        </View>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: 14 + insets.bottom }]}>
        {available === false ? (
          <ThemedText tone="muted" style={styles.unavailable}>
            Sharing isn’t available here.
          </ThemedText>
        ) : (
          <Button title="Share" onPress={share} disabled={available === null || busy} stretch />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.surface },
  content: { gap: 18, alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  preview: { borderRadius: radius.m, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  actions: { paddingTop: 10, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  unavailable: { textAlign: 'center' },
});
