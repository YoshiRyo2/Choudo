/**
 * Wording for the Closet, shared by the web app and the phone.
 */

import { findGarment } from '../domain/garments';
import type { Outfit } from './state/stored';

/** "Name, size" for one slot of an outfit, or null when it's empty or the garment is gone. */
function part(id: string | null, size: string | null): string | null {
  const garment = id ? findGarment(id) : undefined;
  return garment && size ? `${garment.name}, ${size}` : null;
}

/** "Heavy Cotton T-Shirt (5000), L · Slim Chino, 32": top, bottom, dress, then the jacket over them. */
export function outfitLine(outfit: Outfit): string {
  const parts = [
    part(outfit.topId, outfit.topSize),
    part(outfit.bottomId, outfit.bottomSize),
    part(outfit.onepieceId, outfit.onepieceSize),
    part(outfit.outerId, outfit.outerSize),
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' · ') : 'These garments are no longer available';
}
