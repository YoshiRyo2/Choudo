import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, fonts, spacing } from '@/theme';

/** The privacy policy on the website (app/public/privacy.html), linked from the App Store too. */
const PRIVACY_URL = 'https://yoshiryo2.github.io/Choudo/privacy.html';

/** What Choudo is, and that the user's data stays on this phone. A form sheet. */
export default function About() {
  return (
    <ScrollView style={styles.sheet} contentContainerStyle={styles.content}>
      <ThemedText variant="title" accessibilityRole="header">
        About Choudo
      </ThemedText>
      <ThemedText>
        Choudo shows how each size of a shirt or pair of pants would fit you before you buy. Enter your height and
        weight, and it compares each size’s real measurements, from the brand’s size chart, with yours, zone by zone,
        in centimetres.
      </ThemedText>
      <ThemedText style={styles.subheading} accessibilityRole="header">
        Your data stays on this device
      </ThemedText>
      <ThemedText>
        There’s no account and nothing is uploaded: your body, likes, folders and outfits are saved on this phone
        only. Deleting the app removes them.
      </ThemedText>
      <ThemedText>
        When you paste a product link, Choudo reads the brand’s public size chart for it (Uniqlo or Zara): only the
        link’s product code is sent, never your measurements.
      </ThemedText>
      <ThemedText style={styles.link} accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => {})}>
        Privacy policy
      </ThemedText>
      <ThemedText variant="small" tone="muted">
        Affiliate disclosure: to come.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.bg },
  content: { gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xl },
  subheading: { fontFamily: fonts.bold, marginTop: spacing.sm },
  link: { color: colors.ink, textDecorationLine: 'underline', alignSelf: 'flex-start' },
});
