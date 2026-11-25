import { MPLUSRounded1c_500Medium } from '@expo-google-fonts/m-plus-rounded-1c/500Medium';
import { MPLUSRounded1c_700Bold } from '@expo-google-fonts/m-plus-rounded-1c/700Bold';
import { MPLUSRounded1c_800ExtraBold } from '@expo-google-fonts/m-plus-rounded-1c/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { MascotHeadContext } from '@/components/mannequin/head-context';
import { useHead } from '@/hooks/use-head';
import { runMigrations } from '@/storage/kv';
import { colors } from '@/theme';

// Before anything reads storage: move data saved under older keys to the current ones.
runMigrations();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [head] = useHead();
  // Keys are the family names used in theme/typography.ts.
  const [fontsLoaded, fontError] = useFonts({
    MPLUSRounded1c_500Medium,
    MPLUSRounded1c_700Bold,
    MPLUSRounded1c_800ExtraBold,
  });
  // A font that fails to load falls back to the system font rather than a stuck splash.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    // Gestures (Discover's swipe card) only reach views under this root.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MascotHeadContext.Provider value={head}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="body" />
          <Stack.Screen name="fit-reference" />
          <Stack.Screen
            name="fit-details"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.75, 1],
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen
            name="save-outfit"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.35],
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen
            name="folder-picker"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.5, 1],
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen
            name="about"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.6, 1],
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </Stack>
      </MascotHeadContext.Provider>
    </GestureHandlerRootView>
  );
}
