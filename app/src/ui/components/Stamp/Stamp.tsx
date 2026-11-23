import { useId } from 'react';
import { STAMP_BOX, STAMP_GLYPHS } from './stampGlyphs';
import './Stamp.css';

interface StampProps {
  /** Play the drop (once per garment + size per session; see state/stampSeen.ts). Otherwise it is simply there. */
  dropping: boolean;
  className?: string;
}

const C = STAMP_BOX / 2;

/**
 * The ちょうど ("just right") seal: a double ring in --stamp with the glyphs, outlined
 * once into paths (scripts/stamp-glyphs.mjs), so no Japanese font loads. The ink is
 * roughened by a noise filter: displaced edges and a few faint voids.
 */
export function Stamp({ dropping, className }: StampProps) {
  const filterId = `stamp-ink${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      className={['stamp', dropping ? 'is-dropping' : null, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${STAMP_BOX} ${STAMP_BOX}`}
      role="img"
      aria-label="ちょうど: just right"
    >
      <defs>
        <filter id={filterId} x="-6%" y="-6%" width="112%" height="112%">
          {/* Wobble the edges a little, as ink spreads on paper. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="7" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="rough" />
          {/* Fine grain; only its peaks become voids where the ink didn't take. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -6 4.7" result="speckle" />
          <feComposite in="rough" in2="speckle" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <circle className="stamp__ring" cx={C} cy={C} r={45} strokeWidth={5.5} />
        <circle className="stamp__ring" cx={C} cy={C} r={38.5} strokeWidth={1.6} />
        <path className="stamp__glyphs" d={STAMP_GLYPHS} />
      </g>
    </svg>
  );
}
