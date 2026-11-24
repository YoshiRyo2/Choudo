import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';

import { useBody } from '@/hooks/use-body';
import { useFitReference } from '@/hooks/use-fit-reference';
import { useUnits } from '@/hooks/use-units';
import { FitReferenceScreen } from '@/screens/fit-reference';

/** First run (`?first=1`, after the Body screen) or from Edit body. */
export default function FitReferenceRoute() {
  const { first } = useLocalSearchParams<{ first?: string }>();
  const firstRun = first === '1';
  const [body] = useBody();
  const [units] = useUnits();
  const fitRef = useFitReference();

  // Nothing to judge tops against without a body.
  if (body === null) return <Redirect href="/body" />;

  // First run goes on to the tabs whatever the user picks; from Edit body it goes back there.
  const leave = () => {
    if (firstRun || !router.canGoBack()) router.replace('/');
    else router.back();
  };

  return (
    <>
      {/* First run: no back swipe to a Body screen that's already done. */}
      <Stack.Screen options={{ gestureEnabled: !firstRun }} />
      <FitReferenceScreen
        units={units}
        anchor={fitRef.anchor}
        style={fitRef.style}
        skipLabel={firstRun ? 'Skip for now' : 'Cancel'}
        onDone={(anchor, style) => {
          fitRef.set(anchor, style);
          leave();
        }}
        onSkip={leave}
      />
    </>
  );
}
