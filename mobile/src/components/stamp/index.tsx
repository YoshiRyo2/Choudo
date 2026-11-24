import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { STAMP_BOX, STAMP_GLYPHS } from '@choudo/core/ui-logic/components/Stamp/stampGlyphs';

import { colors } from '@/theme';

export interface StampProps {
  /** Play the drop (once per garment + size per launch; useStampDrop). Otherwise it is simply there. */
  dropping: boolean;
  /** When the drop touches down (55 % of it): the haptic and the figure's hop. */
  onLanded?: () => void;
}

const C = STAMP_BOX / 2;
/** Stamp.css: 260 ms, dropped from 1.5×, touching down at 55 % (0.94), a rebound at 78 % (1.03), then still. */
const DROP_MS = 260;
const LANDS_AT = 0.55;
const REBOUND_AT = 0.78;
const FADE_MS = 160;

/**
 * The ちょうど ("just right") seal (the web Stamp): a double ring in the stamp colour with
 * the glyphs as outlined paths, tilted −9°. Drawn without the web's ink-noise filter
 * (react-native-svg has no feTurbulence). With Reduce Motion on, it only fades in.
 */
export function Stamp({ dropping, onLanded }: StampProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(dropping ? 0 : 1);
  const scale = useSharedValue(dropping && !reduceMotion ? 1.5 : 1);

  useEffect(() => {
    if (!dropping) return;
    const ease = Easing.out(Easing.ease);
    if (reduceMotion) {
      opacity.value = withTiming(1, { duration: FADE_MS, easing: ease });
    } else {
      opacity.value = withTiming(1, { duration: DROP_MS * LANDS_AT, easing: ease });
      scale.value = withSequence(
        withTiming(0.94, { duration: DROP_MS * LANDS_AT, easing: ease }),
        withTiming(1.03, { duration: DROP_MS * (REBOUND_AT - LANDS_AT), easing: ease }),
        withTiming(1, { duration: DROP_MS * (1 - REBOUND_AT), easing: ease }),
      );
    }
    const landed = setTimeout(() => onLanded?.(), reduceMotion ? FADE_MS : DROP_MS * LANDS_AT);
    return () => clearTimeout(landed);
    // Once per drop: a new stamp is a new component (keyed by garment + size).
  }, [dropping]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: '-9deg' }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.stamp, style]}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel="ちょうど: just right">
      <Svg viewBox={`0 0 ${STAMP_BOX} ${STAMP_BOX}`} width="100%" height="100%" style={styles.svg}>
        <G>
          <Circle cx={C} cy={C} r={45} strokeWidth={5.5} stroke={colors.stamp} fill="none" />
          <Circle cx={C} cy={C} r={38.5} strokeWidth={1.6} stroke={colors.stamp} fill="none" />
          <Path d={STAMP_GLYPHS} fill={colors.stamp} />
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: { width: 80, height: 80 },
  svg: { overflow: 'visible' },
});
