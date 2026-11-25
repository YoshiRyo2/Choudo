import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { BodyModel, BodyType } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import { catalogueFor, GARMENTS, type CatalogueScope, type Garment } from '@choudo/core/domain/garments';
import { catalogueOptions, endOfMatchingFeedText } from '@choudo/core/ui-logic/catalogueText';
import type { SwipeOutcome } from '@choudo/core/ui-logic/components/SwipeCard/swipe';
import { verdictLine } from '@choudo/core/ui-logic/fitText';
import { buildFeed } from '@choudo/core/ui-logic/state/feed';
import { garmentOdds } from '@choudo/core/ui-logic/state/odds';
import { suggestedFit } from '@choudo/core/ui-logic/state/outfit';

import { Button } from '@/components/button';
import { Segmented } from '@/components/segmented';
import { NextCard, SwipeCard } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import type { Closet } from '@/hooks/use-closet';
import { usePrefetchOdds } from '@/hooks/use-prefetch-odds';
import { colors, fonts, spacing, type } from '@/theme';

export interface DiscoverProps {
  /** Show garments for the user's body type (plus unisex), or all of them. */
  catalogue: CatalogueScope;
  onCatalogueChange: (scope: CatalogueScope) => void;
  model: BodyModel;
  bodyType: BodyType;
  preference: PreferenceSpec;
  closet: Closet;
  /** Changes whenever the route wants a fresh feed (the tab regained focus). */
  feedKey: number;
  onOpenDetails: (garment: Garment, size: string) => void;
  onOpenCloset: () => void;
  /** False while another tab is on screen: the next cards' odds wait (default true). */
  active?: boolean;
}

/** How long the card takes to fly off before the next one is shown (ms; the web's LEAVE_MS). */
const LEAVE_MS = 220;

interface Feed {
  key: number;
  catalogue: CatalogueScope;
  bodyType: BodyType;
  garments: Garment[];
}

/** A feed of garments on your mannequin, one card at a time (the web Discover). */
export function Discover({
  catalogue,
  onCatalogueChange,
  model,
  bodyType,
  preference,
  closet,
  feedKey,
  onOpenDetails,
  onOpenCloset,
  active = true,
}: DiscoverProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const build = (): Feed => ({
    key: feedKey,
    catalogue,
    bodyType,
    garments: buildFeed(catalogueFor(GARMENTS, bodyType, catalogue), closet.swipes),
  });
  // The feed is fixed until the route asks for a new one or the scope changes, so swiping
  // never reshuffles it; a new feed starts from its first card.
  const [feed, setFeed] = useState(build);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<SwipeOutcome>(null);
  if (feed.key !== feedKey || feed.catalogue !== catalogue || feed.bodyType !== bodyType) {
    setFeed(build());
    setIndex(0);
    setLeaving(null);
  }

  // A press lands before the re-render that sets `leaving`: the ref stops a second decision.
  const deciding = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  // A rebuilt feed drops a card that was still flying off.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    deciding.current = false;
  }, [feed]);

  const garment = feed.garments[index];
  const current = useMemo(() => {
    if (!garment) return null;
    const suggested = suggestedFit(model, garment, preference);
    const verdict = verdictLine(garmentOdds(model, garment, preference), suggested.fit.sizeLabel, garment);
    return { garment, ...suggested, verdict };
  }, [garment, model, preference]);
  const hasNext = index + 1 < feed.garments.length;
  // The next two cards' odds, a tick at a time after this render, so swiping on is instant.
  const upcoming = useMemo(() => feed.garments.slice(index + 1, index + 3), [feed, index]);
  usePrefetchOdds(model, preference, upcoming, { active });

  function decide(outcome: 'like' | 'pass') {
    if (!current || deciding.current) return;
    deciding.current = true;
    closet.swipe(current.garment.id, current.fit.sizeLabel, outcome === 'like');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const advance = () => {
      timer.current = null;
      deciding.current = false;
      setLeaving(null);
      setIndex((i) => i + 1);
    };
    // Under Reduce Motion the card is just replaced.
    if (reduceMotion) return advance();
    setLeaving(outcome);
    timer.current = setTimeout(advance, LEAVE_MS);
  }

  const openDetails = () => current && onOpenDetails(current.garment, current.fit.sizeLabel);
  const left = feed.garments.length - index;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Discover
        </Text>
        {current && <ThemedText variant="small" tone="muted" style={styles.meta}>{`${left} to go`}</ThemedText>}
      </View>
      <View style={styles.scope}>
        <Segmented label="Show" hideLabel value={catalogue} options={catalogueOptions(bodyType)} onChange={onCatalogueChange} style={styles.scopeControl} />
      </View>

      {current ? (
        <>
          <View style={styles.deck} accessibilityLabel="Garment cards">
            {hasNext && <NextCard key={`next-${feed.garments[index + 1]!.id}`} />}
            <SwipeCard
              key={current.garment.id}
              garment={current.garment}
              body={model.measurements}
              fit={current.fit}
              recommended={current.recommended}
              verdict={current.verdict}
              leaving={leaving}
              interactive
              onDecide={decide}
              onOpen={openDetails}
            />
          </View>

          <View style={styles.actions}>
            <RoundButton label="Pass" onPress={() => decide('pass')}>
              <Path d="M6 6l12 12M18 6L6 18" fill="none" />
            </RoundButton>
            <Button title="Fit details" variant="outline" size="sm" onPress={openDetails} />
            <RoundButton label="Like" like onPress={() => decide('like')}>
              <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" fill={colors.ink} />
            </RoundButton>
          </View>
        </>
      ) : (
        <View style={styles.end}>
          <Text style={styles.endTitle} accessibilityRole="header">
            No more garments
          </Text>
          {catalogue === 'matching' ? (
            <>
              <ThemedText tone="muted" style={styles.endText}>
                {endOfMatchingFeedText(bodyType)}
              </ThemedText>
              <Button title="Show all garments" variant="outline" onPress={() => onCatalogueChange('all')} />
            </>
          ) : (
            <ThemedText tone="muted" style={styles.endText}>
              You’ve seen everything we have for now. New garments will show up here as we add them.
            </ThemedText>
          )}
          {closet.liked.length > 0 && <Button title={`See your ${closet.liked.length} liked in the Closet`} onPress={onOpenCloset} />}
        </View>
      )}
    </View>
  );
}

/** Discover.css .discover__action: a 60 pt circle with a 28 pt icon; Like is the brand fill. */
function RoundButton({ label, like = false, onPress, children }: { label: string; like?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.round, like && styles.like, pressed && styles.pressed]}>
      <Svg viewBox="0 0 24 24" width={28} height={28} stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
        {children}
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // .screen-head: title and the count on one baseline.
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingTop: 14, paddingHorizontal: spacing.md, paddingBottom: 6 },
  title: { ...type.title, letterSpacing: 0.2 },
  meta: { marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  scope: { alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 6 },
  scopeControl: { width: 240 },
  deck: { flex: 1, minHeight: 320, marginTop: 4, marginHorizontal: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 14, paddingHorizontal: spacing.md },
  round: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  // Like is the positive action: brand fill, ink heart (the line ring stays, as the web's inset shadow).
  like: { backgroundColor: colors.brand },
  pressed: { opacity: 0.7 },
  end: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  endTitle: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 23, color: colors.ink, textAlign: 'center' },
  endText: { maxWidth: 300, textAlign: 'center' },
});
