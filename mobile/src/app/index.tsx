// Temporary: proves Metro reaches packages/core. Replaced by the tabs in Task 5.
import { GARMENTS } from '@choudo/core/domain/garments';
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{GARMENTS.length} garments</Text>
    </View>
  );
}
