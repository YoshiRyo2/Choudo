import { catalogueFor, GARMENTS } from '@choudo/core/domain/garments';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { useBody } from '@/hooks/use-body';
import { Placeholder } from '@/screens/placeholder';
import { spacing } from '@/theme';

// Placeholder until the real Fitting room: shows the shared engine running on the phone.
export default function FittingRoom() {
  const [body] = useBody();
  if (body === null) return null;
  const count = catalogueFor(GARMENTS, body.bodyType, 'matching').length;
  return (
    <Placeholder
      title="Fitting room"
      action={
        <View style={styles.actions}>
          <Button variant="outline" size="sm" title="Edit body" onPress={() => router.push('/body')} />
          {__DEV__ && <Button variant="quiet" size="sm" title="Mannequin lab" onPress={() => router.push('/dev/mannequin')} />}
        </View>
      }>
      {`${body.heightCm} cm · ${count} garments in your sizing`}
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'center', gap: spacing.sm },
});
