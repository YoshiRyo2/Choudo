import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { NameForm } from '@/components/name-form';
import { ThemedText } from '@/components/themed-text';
import { colors, spacing } from '@/theme';

export interface SaveOutfitProps {
  /** The default name, e.g. "Outfit 3": used when the box is left blank. */
  placeholder: string;
  onSave: (name: string) => void;
  onDone: () => void;
}

/** Name the outfit on the mannequin and keep it in the Closet (the web Fitting room's save sheet). */
export function SaveOutfit({ placeholder, onSave, onDone }: SaveOutfitProps) {
  const [saved, setSaved] = useState(false);
  return (
    <View style={styles.sheet}>
      <ThemedText variant="title" accessibilityRole="header">
        {saved ? 'Saved to your Closet' : 'Save this outfit'}
      </ThemedText>
      {saved ? (
        <>
          <ThemedText>Find it under Closet → Outfits.</ThemedText>
          <Button title="Done" onPress={onDone} />
        </>
      ) : (
        <NameForm
          label="Name"
          submitLabel="Save"
          placeholder={placeholder}
          allowBlank
          autoFocus
          onSubmit={(name) => {
            onSave(name);
            setSaved(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, gap: 18, padding: spacing.md, paddingTop: spacing.lg, backgroundColor: colors.surface },
});
