import { GARMENTS } from '@choudo/core/domain/garments';
import { fitReferenceLine } from '@choudo/core/ui-logic/fitText';
import type { BodyInput } from '@choudo/core/domain/body';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';
import { router } from 'expo-router';
import { useState } from 'react';

import { useBody } from '@/hooks/use-body';
import { useFitReference } from '@/hooks/use-fit-reference';
import { useTestMode } from '@/hooks/use-test-mode';
import { useUnits } from '@/hooks/use-units';
import { BodyScreen } from '@/screens/body';

const findGarment = (id: string) => GARMENTS.find((g) => g.id === id);

/** Leave Edit body for wherever it was opened from (the Fitting room). */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function BodyRoute() {
  const [body, setBody] = useBody();
  const [units, setUnits] = useUnits();
  const fitRef = useFitReference();
  const [testMode, setTestMode] = useTestMode();
  // Decided once: saving the body mid-flow must not turn first run into editing.
  const [firstRun] = useState(body === null);

  const save = (input: BodyInput, u: UnitSystem) => {
    setBody(input);
    setUnits(u);
  };

  return (
    <BodyScreen
      initial={firstRun ? null : body}
      units={units}
      onDone={(input, u) => {
        save(input, u);
        if (!firstRun) leave();
        // First time through, offer the fit-reference step once.
        else if (!fitRef.anchor && !fitRef.style) router.replace('/fit-reference?first=1');
        else router.replace('/');
      }}
      onCancel={firstRun ? undefined : leave}
      onAbout={() => router.push('/about')}
      testMode={firstRun ? undefined : { on: testMode, onChange: setTestMode }}
      fitReference={
        firstRun
          ? undefined
          : {
              line: fitReferenceLine(fitRef.anchor, fitRef.style, units, findGarment),
              isSet: fitRef.anchor !== null || fitRef.style !== null,
              onChange: (input, u) => {
                // Keep what was typed on the body form before leaving it.
                if (input) save(input, u);
                router.push('/fit-reference');
              },
              onRemove: fitRef.clear,
            }
      }
    />
  );
}
