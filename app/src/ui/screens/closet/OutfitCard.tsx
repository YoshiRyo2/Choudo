import type { BodyMeasurements } from '../../../domain/body';
import { findGarment } from '../../../domain/garments';
import { Mannequin, type WornGarment } from '../../components/Mannequin/Mannequin';
import type { Outfit } from '../../state/stored';

/** A garment id + size from an outfit, ready for the mannequin (or undefined if it's gone). */
function worn(id: string | null, size: string | null): WornGarment | undefined {
  const garment = id ? findGarment(id) : undefined;
  return garment && size ? { garment, sizeLabel: size } : undefined;
}

/** "Heavy Cotton T-Shirt (5000), L · Slim Chino, 32" */
export function outfitLine(outfit: Outfit): string {
  const part = (w: WornGarment | undefined) => (w ? `${w.garment.name}, ${w.sizeLabel}` : null);
  const parts = [part(worn(outfit.topId, outfit.topSize)), part(worn(outfit.bottomId, outfit.bottomSize))].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'These garments are no longer available';
}

/** A small mannequin wearing an outfit. */
export function OutfitFigure({ body, outfit }: { body: BodyMeasurements; outfit: Outfit }) {
  return (
    <div className="outfit-figure">
      <Mannequin
        body={body}
        top={worn(outfit.topId, outfit.topSize)}
        bottom={worn(outfit.bottomId, outfit.bottomSize)}
        showFit={false}
      />
    </div>
  );
}
