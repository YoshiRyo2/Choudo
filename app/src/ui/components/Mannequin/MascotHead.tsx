import { createContext } from 'react';
import type { FitTone } from '@choudo/core/domain/fit';
import { faceShape, headShape, type Ellipse, type HeadAnchor, type HeadKind } from './heads';

/** The head every Mannequin draws unless told otherwise; App provides the stored choice. */
export const MascotHeadContext = createContext<HeadKind>('cloud');

interface MascotHeadProps {
  kind: HeadKind;
  /** The face's fit tone, or null for no face (the back of the head). */
  face: FitTone | null;
  at: HeadAnchor;
  className?: string;
}

const rotation = (e: Ellipse) => (e.rotate ? `rotate(${e.rotate} ${e.cx} ${e.cy})` : undefined);

/** A mascot head with its face, drawn from heads.ts. A skin: it sits on the body, never shapes it. */
export function MascotHead({ kind, face, at, className }: MascotHeadProps) {
  const shape = headShape(kind, at);
  const f = face ? faceShape(face, shape.puffs[0]!) : null;
  return (
    <g
      className={['mascot-head', `is-${kind}`, className].filter(Boolean).join(' ')}
      data-head={kind}
      data-face={face ?? 'none'}
      aria-hidden="true"
    >
      {shape.ears.map(({ outer, inner }, i) => (
        <g key={i}>
          <ellipse className="mascot-head__ear" cx={outer.cx} cy={outer.cy} rx={outer.rx} ry={outer.ry} transform={rotation(outer)} />
          <ellipse className="mascot-head__ear-inner" cx={inner.cx} cy={inner.cy} rx={inner.rx} ry={inner.ry} transform={rotation(inner)} />
        </g>
      ))}
      {shape.leaf && <path className="mascot-head__leaf" d={shape.leaf} />}
      {/* One outline round the group: a wide ink stroke under, the fills over it, so only the outer edge shows. */}
      <g className="mascot-head__halo">
        {shape.puffs.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
        ))}
      </g>
      <g className="mascot-head__fill">
        {shape.puffs.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
        ))}
      </g>
      {shape.crease && <path className="mascot-head__crease" d={shape.crease} />}
      {f && (
        <g className="mascot-face" data-eyes={f.eyes} data-mouth={f.mouth}>
          {f.blush.map((b, i) => (
            <ellipse key={i} className="mascot-face__blush" cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} />
          ))}
          {f.eyeDots.map((e, i) => (
            <circle key={i} className="mascot-face__eye" cx={e.cx} cy={e.cy} r={e.r} />
          ))}
          {f.eyeArcs.map((d, i) => (
            <path key={i} className="mascot-face__line" d={d} />
          ))}
          <path className="mascot-face__line" d={f.mouthPath} />
        </g>
      )}
    </g>
  );
}

/** A head on its own, for the head picker's buttons: the same drawing at icon size. */
export function MascotHeadIcon({ kind }: { kind: HeadKind }) {
  return (
    <svg className="mascot-icon" viewBox="-15 -29.5 30 31" width="30" height="31" aria-hidden="true" focusable="false">
      <MascotHead kind={kind} face="good" at={{ x: 0, bottom: 0, w: 10 }} />
    </svg>
  );
}
