import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { BodyMeasurements } from '@choudo/core/domain/body';
import type { GarmentFit } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { DISTANCE_SHARE, MAX_TILT, swipeOutcome, type SwipeOutcome } from '@choudo/core/ui-logic/components/SwipeCard/swipe';
import { sizeLine, type VerdictLine } from '@choudo/core/ui-logic/fitText';

import { colors, fonts, radius } from '@/theme';

import { GarmentBadge } from './garment-badge';
import { Mannequin } from './mannequin';
import { ThemedText } from './themed-text';
import { toneColor } from './tone';

export interface SwipeCardProps {
  garment: Garment;
  body: BodyMeasurements;
  fit: GarmentFit;
  /** Whether `fit.sizeLabel` is the recommended size (false = fallback). */
  recommended: boolean;
  /** The personal verdict for the size shown. */
  verdict: VerdictLine;
  /** Set while the card flies off after a decision. */
  leaving: SwipeOutcome;
  /** Only the top card can be dragged. */
  interactive: boolean;
  onDecide: (outcome: 'like' | 'pass') => void;
  onOpen: () => void;
}

/** Movement under this (pt) is a tap, not a drag (the web's TAP_SLOP). */
const TAP_SLOP = 6;
/** How long a still press may last and still count as a tap: "any length". */
const TAP_HOLD_MS = 60_000;
/** SwipeCard.css: snap back and fly off both take 220 ms. */
const MOVE_MS = 220;
/** CSS's `ease` and `ease-in`, as SwipeCard.css uses them. */
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const EASE_IN = Easing.bezier(0.42, 0, 1, 1);
/** Until the card is laid out (the web's fallback width). */
const FALLBACK_WIDTH = 320;

/** Like or pass from where a drag ended: Gesture Handler's velocity is px/s, swipe.ts wants px/ms. */
export function decideDrag(dx: number, velocityXPerSecond: number, width: number): SwipeOutcome {
  return swipeOutcome(dx, velocityXPerSecond / 1000, width);
}

/**
 * swipe.ts's `tilt`, as a worklet so the lean is worked out on the UI thread each frame
 * (core isn't compiled for worklets). A test keeps the two equal.
 */
export function leanFor(dx: number, width: number): number {
  'worklet';
  if (width <= 0) return 0;
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, (dx / width) * MAX_TILT));
}

const ACTIONS = [
  { name: 'like', label: 'Like' },
  { name: 'pass', label: 'Pass' },
  { name: 'details', label: 'Fit details' },
];

/** One garment on the user's mannequin (the web SwipeCard). Drag right to like, left to pass, tap for details. */
export function SwipeCard({ garment, body, fit, recommended, verdict, leaving, interactive, onDecide, onOpen }: SwipeCardProps) {
  const reduceMotion = useReducedMotion();
  const dx = useSharedValue(0);
  const width = useSharedValue(FALLBACK_WIDTH);
  const dragging = useSharedValue(false);
  const gone = useSharedValue(0); // −1 / 1 while flying off
  const lean = useSharedValue(0); // the lean while flying off, eased to ±14° with the slide
  const worn = { garment, sizeLabel: fit.sizeLabel, fit };
  const enabled = interactive && !leaving;

  // Fly off to ±1.4 widths with a ±14° lean (SwipeCard.css .is-leaving). Under Reduce Motion
  // Discover replaces the card at once, so there's nothing to animate.
  useEffect(() => {
    if (!leaving) {
      // Back in play (a rebuilt feed can keep this card): undo a fly-off cut short.
      gone.set(0);
      dx.set(0);
      return;
    }
    if (reduceMotion) return;
    const side = leaving === 'like' ? 1 : -1;
    const move = { duration: MOVE_MS, easing: EASE_IN };
    lean.set(leanFor(dx.get(), width.get()));
    gone.set(side);
    dx.set(withTiming(side * width.get() * 1.4, move));
    lean.set(withTiming(side * 14, move));
  }, [leaving, reduceMotion, dx, gone, lean, width]);

  function snapBack() {
    dx.set(reduceMotion ? 0 : withTiming(0, { duration: MOVE_MS, easing: EASE }));
  }

  function endDrag(moved: number, velocityX: number) {
    const outcome = decideDrag(moved, velocityX, width.get());
    if (outcome) onDecide(outcome);
    else snapBack();
  }

  const pan = Gesture.Pan()
    .withTestId('swipe-pan')
    .enabled(enabled)
    .activeOffsetX([-TAP_SLOP, TAP_SLOP])
    .onStart(() => {
      dragging.set(true);
    })
    .onUpdate((e) => {
      dx.set(e.translationX);
    })
    .onEnd((e, success) => {
      // Cancelled by the system (a call, Control Centre): snap back, as the web's pointercancel.
      if (success) scheduleOnRN(endDrag, e.translationX, e.velocityX);
      else scheduleOnRN(snapBack);
    })
    .onFinalize(() => {
      dragging.set(false);
    });
  const tap = Gesture.Tap()
    .withTestId('swipe-tap')
    .enabled(enabled)
    .maxDistance(TAP_SLOP)
    // A still press of any length opens it, as the web (Gesture Handler gives up after 500 ms).
    .maxDuration(TAP_HOLD_MS)
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(onOpen);
    });

  // A tick as a drag crosses the decide distance, and again if it crosses back.
  useAnimatedReaction(
    () => Math.abs(dx.get()) >= width.get() * DISTANCE_SHARE,
    (far, wasFar) => {
      if (wasFar !== null && far !== wasFar && dragging.get()) scheduleOnRN(Haptics.selectionAsync);
    },
  );

  const cardStyle = useAnimatedStyle(() => {
    const angle = gone.get() !== 0 ? lean.get() : leanFor(dx.get(), width.get());
    return { transform: [{ translateX: dx.get() }, { rotate: `${angle}deg` }] };
  });
  // How sure the drag looks so far, 0..1, for the Like / Pass stamps.
  const intent = () => {
    'worklet';
    return gone.get() !== 0 ? 1 : Math.min(1, Math.abs(dx.get()) / (width.get() * DISTANCE_SHARE));
  };
  const likeStyle = useAnimatedStyle(() => ({ opacity: dx.get() > 0 ? intent() : 0 }));
  const passStyle = useAnimatedStyle(() => ({ opacity: dx.get() < 0 ? intent() : 0 }));

  function onAccessibilityAction(e: AccessibilityActionEvent) {
    if (!enabled) return;
    const action = e.nativeEvent.actionName;
    if (action === 'like' || action === 'pass') onDecide(action);
    else if (action === 'details') onOpen();
  }

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        style={[styles.card, cardStyle]}
        onLayout={(e) => width.set(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={`${garment.brand} ${garment.name}`}
        // An accessible view's label hides its text from VoiceOver: the size and verdict follow the name.
        accessibilityValue={{ text: `${sizeLine(fit.sizeLabel, recommended)}. ${verdict.headline}` }}
        accessibilityActions={ACTIONS}
        onAccessibilityAction={onAccessibilityAction}>
        <View style={styles.stage}>
          <Mannequin
            body={body}
            top={garment.category === 'top' ? worn : undefined}
            bottom={garment.category === 'bottom' ? worn : undefined}
            onepiece={garment.category === 'onepiece' ? worn : undefined}
            outer={garment.category === 'outer' ? worn : undefined}
            showFit={false}
            showHeightTape={false}
            frame="body"
            face={verdict.tone}
          />
          <Animated.View style={[styles.stamp, styles.like, likeStyle]} pointerEvents="none">
            <Text style={[styles.stampText, { color: colors.ink }]}>Like</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.pass, passStyle]} pointerEvents="none">
            <Text style={[styles.stampText, { color: colors.muted }]}>Pass</Text>
          </Animated.View>
        </View>
        <View style={styles.info}>
          <View style={styles.brandRow}>
            <ThemedText variant="small" tone="muted">
              {garment.brand}
            </ThemedText>
            <GarmentBadge garment={garment} />
          </View>
          <Text style={styles.name}>{garment.name}</Text>
          <Text style={styles.size}>{sizeLine(fit.sizeLabel, recommended)}</Text>
          <View style={styles.verdict}>
            <View style={[styles.dot, { backgroundColor: toneColor[verdict.tone] }]} />
            <Text style={[styles.verdictText, { color: toneColor[verdict.tone] }]}>{verdict.headline}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** The card waiting underneath (SwipeCard.css .is-next): a plain stand-in, no second mannequin. */
export function NextCard() {
  return <View style={[styles.card, styles.next]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  // translateY 10, scale 0.94 about the bottom edge (SwipeCard.css .is-next).
  next: { opacity: 0.6, transform: [{ translateY: 10 }, { scale: 0.94 }], transformOrigin: '50% 100%' },
  stage: { flex: 1, minHeight: 0, paddingTop: 12, paddingHorizontal: 12, backgroundColor: colors.peachTint },
  stamp: {
    position: 'absolute',
    top: 18,
    paddingVertical: 2,
    paddingHorizontal: 12,
    borderWidth: 3,
    borderRadius: radius.s,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  like: { left: 16, borderColor: colors.ink, transform: [{ rotate: '-12deg' }] },
  pass: { right: 16, borderColor: colors.muted, transform: [{ rotate: '12deg' }] },
  stampText: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, textTransform: 'uppercase', letterSpacing: 1.3 },
  info: { gap: 2, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.line },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 23, color: colors.ink },
  size: { marginTop: 2, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  verdictText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, flexShrink: 1 },
});
