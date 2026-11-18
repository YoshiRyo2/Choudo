import { useMemo } from 'react';
import { estimateBody, type BodyInput } from '../../domain/body';
import { Mannequin } from '../components/Mannequin/Mannequin';
import type { UnitSystem } from '../state/stored';

interface FittingRoomProps {
  body: BodyInput;
  units: UnitSystem;
  onUnitsChange: (units: UnitSystem) => void;
  onEditBody: () => void;
}

// Placeholder: the browse + fit UI lands in the next step.
export function FittingRoom({ body, onEditBody }: FittingRoomProps) {
  const model = useMemo(() => estimateBody(body), [body]);
  return (
    <main style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <p className="wordmark">Nimbus</p>
      <div style={{ height: '60dvh' }}>
        <Mannequin body={model.measurements} />
      </div>
      <button className="button button--quiet" onClick={onEditBody}>
        Edit measurements
      </button>
    </main>
  );
}
