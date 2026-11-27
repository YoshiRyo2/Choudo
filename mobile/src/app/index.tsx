import { Redirect } from 'expo-router';

/** The app opens on the Check tab ("What size should I buy?"); the tabs send a first run to /body. */
export default function Home() {
  return <Redirect href="/check" />;
}
