import { View } from 'react-native';

import { Button } from '@/components/button';

import { stepStyles } from './option-card';

/** Save (dimmed until the step can save, but a press still reaches it) and Back. */
export function StepActions({ canSave, onSave, onBack }: { canSave: boolean; onSave: () => void; onBack: () => void }) {
  return (
    <View style={stepStyles.actions}>
      <Button title="Save" onPress={onSave} disabled={!canSave} />
      <Button variant="quiet" title="Back" onPress={onBack} />
    </View>
  );
}
