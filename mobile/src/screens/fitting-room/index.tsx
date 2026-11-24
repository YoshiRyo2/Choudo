import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BodyInput, BodyModel } from '@choudo/core/domain/body';
import { fitAllSizes, type GarmentFit, type GarmentOdds, type PreferenceSpec, type UnderLayer } from '@choudo/core/domain/fit';
import { findGarment, type CatalogueScope, type Garment, type GarmentCategory } from '@choudo/core/domain/garments';
import { catalogueToggle, emptyCategoryText } from '@choudo/core/ui-logic/catalogueText';
import type { HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import type { View as Side } from '@choudo/core/ui-logic/components/Mannequin/view';
import { fittingHeadline, isJustRight } from '@choudo/core/ui-logic/fitText';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { defaultSize, wearGarment } from '@choudo/core/ui-logic/state/outfit';
import { stampKey } from '@choudo/core/ui-logic/state/stampSeen';
import type { Outfit, UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { FitAnswer } from '@/components/fit-answer';
import { GarmentCarousel } from '@/components/garment-carousel';
import { Mannequin, type WornGarment } from '@/components/mannequin';
import { Segmented } from '@/components/segmented';
import { SizePicker } from '@/components/size-picker';
import { useStampDrop } from '@/components/stamp/use-stamp-drop';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { colors, fonts, radius, spacing } from '@/theme';

import { Stage } from './stage';

export interface FittingRoomProps {
  body: BodyInput;
  model: BodyModel;
  /** How the user likes tops to fit. */
  preference: PreferenceSpec;
  units: UnitSystem;
  onUnitsChange: (units: UnitSystem) => void;
  /** The outfit on the mannequin, resolved (resolveOutfit). */
  outfit: Outfit;
  onOutfitChange: (outfit: Outfit) => void;
  /** Show garments for the body type (plus unisex), or all of them; and what that shows. */
  catalogue: CatalogueScope;
  onCatalogueChange: (scope: CatalogueScope) => void;
  shown: readonly Garment[];
  head: HeadKind;
  onHeadChange: (head: HeadKind) => void;
  onEditBody: () => void;
  /** Open Fit details for the garment shown, in its size. */
  onDetails: (garmentId: string, size: string) => void;
  onSaveOutfit: () => void;
  /** Development only: a way into the mannequin lab, at the bottom of the panel. */
  devTools?: React.ReactNode;
}

interface Slot {
  garment: Garment;
  size: string;
  fits: GarmentFit[];
  fit: GarmentFit;
  odds: GarmentOdds;
  recommended: string | null;
}

const CAROUSEL_LABEL: Record<GarmentCategory, string> = { top: 'Tops', bottom: 'Bottoms', onepiece: 'Dresses', outer: 'Jackets' };

/** Garments (with what's under them) whose odds this launch has already worked out: the dev timing log's first-look list. */
const timed = new Set<string>();

/** garmentOdds, timed the first time per garment in development (Review Focus: 500 samples on Hermes, no JIT). */
function oddsFor(model: BodyModel, garment: Garment, preference: PreferenceSpec, under?: UnderLayer): GarmentOdds {
  const key = under ? `${garment.id} over ${under.garment.id} ${under.sizeLabel}` : garment.id;
  if (!__DEV__ || timed.has(key) || process.env.NODE_ENV === 'test') return garmentOdds(model, garment, preference, under);
  timed.add(key);
  const start = performance.now();
  const odds = garmentOdds(model, garment, preference, under);
  console.log(`[odds] ${key}: ${Math.round(performance.now() - start)} ms`);
  return odds;
}

/** The haptic for a size or garment picked by tap or swipe (the phone's own settings decide if it plays). */
const tick = () => void Haptics.selectionAsync().catch(() => {});

/**
 * The Fitting room (the web FittingRoom): what's on the mannequin, its plain fit answer,
 * sizes, and the browsing panel. The numbers live in the Fit details sheet.
 */
export function FittingRoom({
  body,
  model,
  preference,
  units,
  onUnitsChange,
  outfit,
  onOutfitChange: setSaved,
  catalogue,
  onCatalogueChange,
  shown,
  head,
  onHeadChange,
  onEditBody,
  onDetails,
  onSaveOutfit,
  devTools,
}: FittingRoomProps) {
  // Open on the dress when one is worn: the Top tab would have nothing on to show.
  const [browsing, setBrowsing] = useState<GarmentCategory>(() => (outfit.onepieceId ? 'onepiece' : 'top'));
  // Which side of the mannequin is shown; a drawing choice only, not stored.
  const [view, setView] = useState<Side>('front');

  const slot = (id: string | null, size: string | null, under?: UnderLayer): Slot | null => {
    const garment = id ? findGarment(id) : undefined;
    if (!garment || !size) return null;
    const fits = fitAllSizes(model, garment, under);
    const odds = oddsFor(model, garment, preference, under);
    return { garment, size, fits, fit: fits.find((f) => f.sizeLabel === size)!, odds, recommended: odds.recommended };
  };
  // A handful of sizes per garment, and the odds are cached: cheap enough every render.
  const top = slot(outfit.topId, outfit.topSize);
  const bottom = slot(outfit.bottomId, outfit.bottomSize);
  const onepiece = slot(outfit.onepieceId, outfit.onepieceSize);
  // A jacket is fitted over the top (or the dress) under it; its size cards elsewhere stay bare-body.
  const topGarment = (top ?? onepiece)?.garment;
  const topSize = (top ?? onepiece)?.size;
  const under = useMemo<UnderLayer | undefined>(
    () => (topGarment && topSize ? { garment: topGarment, sizeLabel: topSize } : undefined),
    [topGarment, topSize],
  );
  const outer = slot(outfit.outerId, outfit.outerSize, under);

  // The Dress tab shows when there's a dress on show or one is worn (none for a men's body on its own sizing).
  const hasDresses = onepiece !== null || shown.some((g) => g.category === 'onepiece');
  const tab: GarmentCategory = browsing === 'onepiece' && !hasDresses ? 'top' : browsing;
  const active = { top, bottom, outer, onepiece }[tab];

  // The face follows the shown size's verdict tone; the ちょうど stamp shows when it is the
  // suggested size and the headline says it fits, and drops once per garment + size.
  const face = active ? fittingHeadline(active.odds, active.size, active.garment).tone : 'unknown';
  const stamp = active && isJustRight(active.odds, active.size, active.garment) ? stampKey(active.garment.id, active.size) : null;
  const dropping = useStampDrop(stamp);

  function chooseGarment(id: string) {
    const garment = findGarment(id);
    if (!garment) return;
    tick();
    // A jacket starts in the size suggested over the top it goes on.
    const overTop = garment.category === 'outer' ? oddsFor(model, garment, preference, under).recommended : null;
    setSaved(wearGarment(outfit, garment, overTop ?? defaultSize(model, garment, preference)));
  }

  function chooseSize(size: string) {
    tick();
    if (tab === 'top') setSaved({ ...outfit, topSize: size });
    else if (tab === 'bottom') setSaved({ ...outfit, bottomSize: size });
    else if (tab === 'onepiece') setSaved({ ...outfit, onepieceSize: size });
    else setSaved({ ...outfit, outerSize: size });
  }

  const takeOffJacket = () => setSaved({ ...outfit, outerId: null, outerSize: null });

  // The carousel: what's on show in this category, plus the worn garment if the filter hides it.
  const inCategory = shown.filter((g) => g.category === tab);
  const carousel = active && !inCategory.includes(active.garment) ? [active.garment, ...inCategory] : inCategory;
  const show = catalogueToggle(body.bodyType, catalogue);

  const worn = (s: Slot | null): WornGarment | undefined => (s ? { garment: s.garment, sizeLabel: s.size, fit: s.fit } : undefined);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.bar}>
        <Wordmark />
        <Segmented
          label="Units"
          hideLabel
          value={units}
          options={[
            { value: 'metric', label: 'cm' },
            { value: 'imperial', label: 'in' },
          ]}
          onChange={onUnitsChange}
          style={styles.units}
        />
        <View style={styles.edit}>
          <Button variant="quiet" size="sm" title="Edit body" onPress={onEditBody} />
        </View>
      </View>

      <View style={styles.garment}>
        <View style={styles.garmentName}>
          {active && (
            <>
              <Text style={styles.name} numberOfLines={1}>
                {active.garment.name}
              </Text>
              <Text style={styles.brand} numberOfLines={1}>
                {active.garment.brand}
              </Text>
            </>
          )}
        </View>
        <Segmented
          label="View"
          hideLabel
          value={view}
          options={[
            { value: 'front', label: 'Front' },
            { value: 'back', label: 'Back' },
          ]}
          onChange={setView}
          style={styles.view}
        />
      </View>

      {active && (
        <View style={styles.answer}>
          <FitAnswer garment={active.garment} size={active.size} odds={active.odds} />
        </View>
      )}

      <Stage
        head={head}
        onHeadChange={onHeadChange}
        stamp={stamp}
        dropping={dropping}
        onStampLanded={() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})}
        onSave={onSaveOutfit}>
        <Mannequin
          body={model.measurements}
          top={worn(top)}
          bottom={worn(bottom)}
          onepiece={worn(onepiece)}
          outer={worn(outer)}
          frame="body"
          view={view}
          showHeightTape={false}
          head={head}
          face={face}
        />
      </Stage>

      {active && (
        <View style={styles.sizes}>
          <SizePicker
            key={active.garment.id}
            layout="row"
            fits={active.fits}
            selected={active.size}
            recommended={active.recommended}
            odds={active.odds}
            onSelect={chooseSize}
          />
          <View style={styles.details}>
            <Button variant="outline" title="See fit details" onPress={() => onDetails(active.garment.id, active.size)} />
          </View>
        </View>
      )}

      <View style={styles.panel}>
        <Segmented
          label="Browsing"
          hideLabel
          value={tab}
          options={[
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            ...(hasDresses ? [{ value: 'onepiece' as const, label: 'Dress' }] : []),
            { value: 'outer', label: 'Jacket' },
          ]}
          onChange={setBrowsing}
        />

        {carousel.length > 0 ? (
          <GarmentCarousel
            key={`${tab}-${catalogue}`}
            label={CAROUSEL_LABEL[tab]}
            garments={carousel}
            selectedId={active?.garment.id ?? null}
            onSelect={chooseGarment}
            headerAction={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={show.accessibleName}
                onPress={() => onCatalogueChange(show.next)}
                hitSlop={{ top: 6, bottom: 6 }}
                style={({ pressed }) => [styles.show, pressed && styles.pressed]}>
                <Text style={styles.showText} numberOfLines={1}>
                  {show.label}
                </Text>
              </Pressable>
            }
          />
        ) : (
          <View style={styles.empty}>
            <ThemedText tone="muted">{emptyCategoryText(body.bodyType, tab)}</ThemedText>
            <Button variant="outline" size="sm" title="Show all" onPress={() => onCatalogueChange('all')} />
          </View>
        )}

        {tab === 'outer' && outer && <Button variant="outline" size="sm" title="Take off the jacket" onPress={takeOffJacket} />}

        {devTools}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 0 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingHorizontal: spacing.md },
  units: { width: 96 },
  edit: { marginLeft: 'auto' },
  // Garment name and brand on the left, Front/Back on the right.
  garment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 10, paddingHorizontal: spacing.md },
  garmentName: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  brand: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.muted },
  view: { width: 132 },
  answer: { paddingTop: 14, paddingHorizontal: spacing.md },
  sizes: { gap: 14, paddingTop: 8, paddingHorizontal: spacing.md },
  details: { alignItems: 'center' },
  panel: {
    gap: 20,
    marginTop: 24,
    paddingTop: 18,
    paddingHorizontal: spacing.md,
    paddingBottom: 32,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1.5,
    borderColor: colors.line,
  },
  // The compact Show chip in the carousel header: looks 32 tall, takes taps over 44.
  show: {
    minHeight: 32,
    minWidth: 44,
    maxWidth: 150,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  showText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: colors.ink },
  pressed: { opacity: 0.7 },
  empty: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 8, paddingVertical: 16 },
});
