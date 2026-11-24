import { Redirect, router } from 'expo-router';

import { MannequinLab } from '@/screens/dev/mannequin-lab';

/** /dev/mannequin: the mannequin lab, in development only. A store build lands on the Fitting room instead. */
export default function MannequinLabRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <MannequinLab onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
