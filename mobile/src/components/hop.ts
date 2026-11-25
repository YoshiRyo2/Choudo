import { useEffect } from 'react';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

/** motion.ts: up 7 pt and back in 380 ms (the top at 45 %), starting 140 ms in, as the stamp touches down. */
const HOP_PT = 7;
const HOP_MS = 380;
const HOP_PEAK = 0.45;
const HOP_DELAY_MS = 140;

/**
 * The figure's hop when the ちょうど stamp drops: an animated style for the figure's
 * wrapper. Translate only: the body is never scaled, so its proportions stay the fit
 * engine's. Nothing with Reduce Motion on.
 */
export function useHop(dropping: boolean, key: string | null) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!dropping || reduceMotion) return;
    y.value = withDelay(
      HOP_DELAY_MS,
      withSequence(
        withTiming(-HOP_PT, { duration: HOP_MS * HOP_PEAK, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: HOP_MS * (1 - HOP_PEAK), easing: Easing.in(Easing.ease) }),
      ),
    );
  }, [dropping, key, reduceMotion, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}
