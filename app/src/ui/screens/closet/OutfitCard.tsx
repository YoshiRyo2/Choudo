import type { BodyMeasurements } from '@choudo/core/domain/body';
import { findGarment } from '@choudo/core/domain/garments';
import { Mannequin, type WornGarment } from '../../components/Mannequin/Mannequin';
import type { Outfit } from '@choudo/core/ui-logic/state/stored';

/** A garment id + size from an outfit, ready for the mannequin (or undefined if it's gone). */
function worn(id: string | null, size: string | null): WornGarment | undefined {
  const garment = id ? findGarment(id) : undefined;
  return garment && size ? { garment, sizeLabel: size } : undefined;
}

/** A small mannequin wearing an outfit. */
export function OutfitFigure({ body, outfit }: { body: BodyMeasurements; outfit: Outfit }) {
  return (
    <div className="outfit-figure">
      <Mannequin
        body={body}
        top={worn(outfit.topId, outfit.topSize)}
        bottom={worn(outfit.bottomId, outfit.bottomSize)}
        onepiece={worn(outfit.onepieceId, outfit.onepieceSize)}
        outer={worn(outfit.outerId, outfit.outerSize)}
        showFit={false}
      />
    </div>
  );
}
