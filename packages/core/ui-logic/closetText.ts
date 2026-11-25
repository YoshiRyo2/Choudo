/**
 * Wording for the Closet, shared by the web app and the phone.
 */

import { findGarment, type Garment } from '../domain/garments';
import type { Outfit } from './state/stored';

/** An outfit's garments with their sizes, top, bottom, dress, then the jacket over them; ones that are gone are left out. */
function wornIn(outfit: Outfit): { garment: Garment; size: string }[] {
  const slots: [string | null, string | null][] = [
    [outfit.topId, outfit.topSize],
    [outfit.bottomId, outfit.bottomSize],
    [outfit.onepieceId, outfit.onepieceSize],
    [outfit.outerId, outfit.outerSize],
  ];
  return slots.flatMap(([id, size]) => {
    const garment = id ? findGarment(id) : undefined;
    return garment && size ? [{ garment, size }] : [];
  });
}

/** "Heavy Cotton T-Shirt (5000), L · Slim Chino, 32": top, bottom, dress, then the jacket over them. */
export function outfitLine(outfit: Outfit): string {
  const parts = wornIn(outfit).map(({ garment, size }) => `${garment.name}, ${size}`);
  return parts.length > 0 ? parts.join(' · ') : 'These garments are no longer available';
}

/** One line per garment for a shared outfit picture: "{brand} {name} · {size}", in outfitLine's order. */
export function outfitGarmentLines(outfit: Outfit): string[] {
  return wornIn(outfit).map(({ garment, size }) => `${garment.brand} ${garment.name} · ${size}`);
}
