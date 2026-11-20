import { useState } from 'react';
import type { Garment } from '../../domain/garments';
import { thumbPhotoSrc } from './garmentThumb';
import './GarmentIcon.css';

/**
 * The garment's picture on browse cards: its front photo, shown as it is, when the
 * licence allows (see thumbPhotoSrc); otherwise, or if the photo fails to load, a
 * little flat drawing in its colour. Decorative: the card already names the garment.
 */
export function GarmentIcon({ garment }: { garment: Garment }) {
  const src = thumbPhotoSrc(garment, import.meta.env.BASE_URL);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && src !== failedSrc) {
    return (
      <img
        className="garment-icon garment-icon--photo"
        src={src}
        alt=""
        width={56}
        height={60}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return <GarmentDrawing garment={garment} />;
}

/** Little flat drawing of the garment in its colour. */
function GarmentDrawing({ garment }: { garment: Garment }) {
  const fill = garment.color;
  const stroke = 'color-mix(in srgb, var(--ink) 55%, transparent)';
  let d: string;
  if (garment.type === 'skirt') {
    d = 'M18 6 H42 L44 16 L54 56 H6 L16 16 Z';
  } else if (garment.type === 'shorts') {
    d = 'M12 6 H48 L54 36 H34 L30 22 L26 36 H6 Z';
  } else if (garment.category === 'bottom') {
    const wide = garment.type === 'trousers' ? 4 : garment.type === 'joggers' ? -2 : 0;
    d = `M14 6 H46 L${50 + wide} 58 H${34} L30 24 L26 58 H${10 - wide} Z`;
  } else if (garment.sleeve === 'long') {
    d = 'M22 6 Q30 12 38 6 L50 10 L58 50 L50 52 L44 22 L44 58 H16 L16 22 L10 52 L2 50 L10 10 Z';
  } else {
    d = 'M22 6 Q30 12 38 6 L52 12 L58 26 L48 30 L44 24 L44 58 H16 L16 24 L12 30 L2 26 L8 12 Z';
  }
  return (
    <svg viewBox="0 0 60 64" width="56" height="60" aria-hidden="true" className="garment-icon">
      <path d={d} fill={fill} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
      {garment.type === 'button-up' && <line x1="30" y1="11" x2="30" y2="58" stroke={stroke} strokeWidth="1" />}
      {garment.type === 'polo' && <path d="M26 9 L30 18 L34 9" fill="none" stroke={stroke} strokeWidth="1" />}
    </svg>
  );
}
