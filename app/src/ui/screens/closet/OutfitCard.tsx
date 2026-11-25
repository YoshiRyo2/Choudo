import type { BodyMeasurements } from '@choudo/core/domain/body';
import type { Garment } from '@choudo/core/domain/garments';
import { Mannequin, type WornGarment } from '../../components/Mannequin/Mannequin';
import type { Outfit } from '@choudo/core/ui-logic/state/stored';

/** A garment id + size from an outfit, ready for the mannequin (or undefined if it's gone). */
function worn(garments: readonly Garment[], id: string | null, size: string | null): WornGarment | undefined {
  const garment = id ? garments.find((g) => g.id === id) : undefined;
  return garment && size ? { garment, sizeLabel: size } : undefined;
}

/** A small mannequin wearing an outfit. */
export function OutfitFigure({ body, outfit, garments }: { body: BodyMeasurements; outfit: Outfit; garments: readonly Garment[] }) {
  return (
    <div className="outfit-figure">
      <Mannequin
        body={body}
        top={worn(garments, outfit.topId, outfit.topSize)}
        bottom={worn(garments, outfit.bottomId, outfit.bottomSize)}
        onepiece={worn(garments, outfit.onepieceId, outfit.onepieceSize)}
        outer={worn(garments, outfit.outerId, outfit.outerSize)}
        showFit={false}
      />
    </div>
  );
}
