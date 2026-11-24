import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { HEAD_KINDS, HEAD_NAME, type HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';

import { useHop } from '@/components/hop';
import { MascotHeadIcon } from '@/components/mannequin/mascot-head';
import { Stamp } from '@/components/stamp';
import { colors } from '@/theme';

export interface StageProps {
  /** The mannequin. */
  children: ReactNode;
  head: HeadKind;
  onHeadChange: (head: HeadKind) => void;
  /** The ちょうど stamp's key (garment + size), or null for none. */
  stamp: string | null;
  dropping: boolean;
  onStampLanded: () => void;
  onSave: () => void;
}

/**
 * The Fitting room's stage (FittingRoom.css): the mannequin in front of a peach circle, the
 * head picker down the left, the stamp at the top right and Save outfit at the bottom right.
 */
export function Stage({ children, head, onHeadChange, stamp, dropping, onStampLanded, onSave }: StageProps) {
  const hop = useHop(dropping, stamp);
  return (
    <View style={styles.stage} testID="stage">
      <View style={styles.circle} />
      {/* The hop moves this wrapper (translate only), so the drawing itself isn't redrawn. */}
      <Animated.View style={[styles.figure, hop]}>{children}</Animated.View>
      <View style={styles.heads}>
        {HEAD_KINDS.map((kind) => {
          const selected = head === kind;
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={`${HEAD_NAME[kind]} head`}
              accessibilityState={{ selected }}
              onPress={() => onHeadChange(kind)}
              style={({ pressed }) => [styles.round, selected && styles.headSelected, pressed && styles.pressed]}>
              <MascotHeadIcon kind={kind} />
            </Pressable>
          );
        })}
      </View>
      {stamp && (
        <View style={styles.stamp} pointerEvents="none">
          <Stamp key={stamp} dropping={dropping} onLanded={onStampLanded} />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save outfit"
        onPress={onSave}
        style={({ pressed }) => [styles.round, styles.save, pressed && styles.pressed]}>
        {/* A bookmark with a plus: keep this outfit. */}
        <Svg viewBox="0 0 24 24" width={22} height={22} accessible={false}>
          <Path
            d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1ZM12 7.5v6M9 10.5h6"
            fill="none"
            stroke={colors.ink}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const CIRCLE = 316;

const styles = StyleSheet.create({
  stage: { height: 356, marginTop: 8, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  circle: { position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.peachSoft },
  figure: { ...StyleSheet.absoluteFill, overflow: 'visible' },
  heads: { position: 'absolute', top: 0, left: 16, gap: 8 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The chosen head: an ink disc (the drawing's own fills keep it readable).
  headSelected: { backgroundColor: colors.ink },
  pressed: { opacity: 0.7 },
  // Just outside the peach circle, so the stamp ink lands on the background (4.5:1 there).
  stamp: { position: 'absolute', top: 2, right: 10 },
  save: { position: 'absolute', bottom: 0, right: 16 },
});
