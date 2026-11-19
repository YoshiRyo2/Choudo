import type { Garment } from '../../domain/garments';
import { garmentTag } from '../fitText';

/** "Sample data" for invented rows, otherwise how far to trust the numbers: "From size chart", … */
export function GarmentBadge({ garment, className }: { garment: Pick<Garment, 'source' | 'grade'>; className?: string }) {
  const tag = garmentTag(garment);
  return <span className={['garment-tag', `is-${tag.kind}`, className].filter(Boolean).join(' ')}>{tag.text}</span>;
}
