import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { ThemedText } from './themed-text';

/** The Choudo lockup: the app icon (decorative) next to the name. */
export function Wordmark() {
  return (
    <View style={styles.row}>
      <Image source={require('../../assets/images/wordmark-icon.png')} style={styles.icon} accessible={false} />
      <ThemedText variant="title">Choudo</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 28, height: 28, borderRadius: 7 },
});
