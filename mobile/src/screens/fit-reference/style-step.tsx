import { useState } from 'react';
import { View } from 'react-native';
import { FIT_STYLES, type FitStyle } from '@choudo/core/domain/fit';
import { FIT_STYLE_TEXT } from '@choudo/core/ui-logic/fitText';

import { OptionCard, stepStyles } from './option-card';
import { StepActions } from './step-actions';

/** "How do you like tees to fit?": slim, regular, relaxed or oversized. */
export function StyleStep({
  initial,
  onSave,
  onBack,
}: {
  initial: FitStyle | null;
  onSave: (style: FitStyle) => void;
  onBack: () => void;
}) {
  const [style, setStyle] = useState<FitStyle | null>(initial);
  return (
    <View style={stepStyles.form}>
      <View style={stepStyles.list} accessibilityRole="radiogroup" accessibilityLabel="Fit">
        {FIT_STYLES.map((s) => (
          <OptionCard
            key={s}
            title={FIT_STYLE_TEXT[s].label}
            subtitle={FIT_STYLE_TEXT[s].hint}
            selected={s === style}
            onPress={() => setStyle(s)}
          />
        ))}
      </View>
      <StepActions canSave={style !== null} onSave={() => style && onSave(style)} onBack={onBack} />
    </View>
  );
}
