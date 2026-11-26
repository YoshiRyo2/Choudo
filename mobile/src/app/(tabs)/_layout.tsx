import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { useBody } from '@/hooks/use-body';
import { colors } from '@/theme';

export default function TabsLayout() {
  const [body] = useBody();
  // First run: nothing to fit until we know the body.
  if (body === null) return <Redirect href="/body" />;

  return (
    <NativeTabs tintColor={colors.ink}>
      {/* First: the app opens here (src/app/index.tsx redirects to it). */}
      <NativeTabs.Trigger name="check">
        <NativeTabs.Trigger.Icon sf="link" md="link" />
        <NativeTabs.Trigger.Label>Check</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fitting-room">
        <NativeTabs.Trigger.Icon sf="hanger" md="checkroom" />
        <NativeTabs.Trigger.Label>Fitting room</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Icon sf="rectangle.stack" md="style" />
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="closet">
        <NativeTabs.Trigger.Icon sf="cabinet" md="shelves" />
        <NativeTabs.Trigger.Label>Closet</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
