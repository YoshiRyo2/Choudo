import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { MascotHeadContext } from '@/components/mannequin/head-context';
import { GarmentLookupContext, useGarmentLookup } from '@/hooks/use-fetched';
import { useHead } from '@/hooks/use-head';
import { runMigrations } from '@/storage/kv';
import { colors } from '@/theme';

// Before anything reads storage: move data saved under older keys to the current ones.
runMigrations();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [head] = useHead();
  // Garments read from pasted links are found everywhere a seed garment is.
  const garments = useGarmentLookup();
  // Keys are the family names used in theme/typography.ts. The files are Latin subsets of
  // M PLUS Rounded 1c (npm run fonts), about 65 KB each instead of 3.4 MB.
  const [fontsLoaded, fontError] = useFonts({
    MPLUSRounded1c_500Medium: require('../../assets/fonts/MPLUSRounded1c-Medium.ttf'),
    MPLUSRounded1c_700Bold: require('../../assets/fonts/MPLUSRounded1c-Bold.ttf'),
    MPLUSRounded1c_800ExtraBold: require('../../assets/fonts/MPLUSRounded1c-ExtraBold.ttf'),
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
        <GarmentLookupContext.Provider value={garments}>
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
            name="folder/[id]"
            options={{ headerShown: true, headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}
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
            name="share-outfit"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.9],
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
        </GarmentLookupContext.Provider>
      </MascotHeadContext.Provider>
    </GestureHandlerRootView>
  );
}
