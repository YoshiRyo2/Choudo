import { useState } from 'react';
import type { BodyInput } from './domain/body';
import { BodyScreen } from './ui/screens/BodyScreen';
import { FittingRoom } from './ui/screens/FittingRoom';
import { usePersistentState } from './ui/state/usePersistentState';
import { isStoredBody, isUnitSystem, STORAGE_KEYS, type UnitSystem } from './ui/state/stored';

/**
 * Two screens: enter your body, then the fitting room. Everything the user
 * enters is kept in this browser's localStorage — nothing leaves the device.
 */
export function App() {
  const [body, setBody] = usePersistentState<BodyInput | null>(STORAGE_KEYS.body, null, isStoredBody);
  const [units, setUnits] = usePersistentState<UnitSystem>(STORAGE_KEYS.units, 'metric', isUnitSystem);
  const [editing, setEditing] = useState(false);

  if (!body || editing) {
    return (
      <BodyScreen
        initial={body}
        units={units}
        onDone={(input, u) => {
          setBody(input);
          setUnits(u);
          setEditing(false);
        }}
        onCancel={body ? () => setEditing(false) : undefined}
      />
    );
  }

  return <FittingRoom body={body} units={units} onUnitsChange={setUnits} onEditBody={() => setEditing(true)} />;
}
