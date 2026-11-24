import type { FitTone } from '@choudo/core/domain/fit';
import { faceShape, headShape, type Ellipse as Oval, type HeadAnchor, type HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { paint } from './paint';

interface MascotHeadProps {
  kind: HeadKind;
  /** The face's fit tone, or null for no face (the back of the head). */
  face: FitTone | null;
  at: HeadAnchor;
  /** View-box units per screen point (px(1, renderedWidth)), for the outline widths. */
  unit: number;
  /** The head picker's lighter lines. */
  icon?: boolean;
}

const rotation = (e: Oval) => (e.rotate ? `rotate(${e.rotate} ${e.cx} ${e.cy})` : undefined);

/** A mascot head with its face, drawn from heads.ts. A skin: it sits on the body, never shapes it. */
export function MascotHead({ kind, face, at, unit, icon = false }: MascotHeadProps) {
  const shape = headShape(kind, at);
  const f = face ? faceShape(face, shape.puffs[0]!) : null;
  const fill = kind === 'peach' ? paint.headFillPeach : paint.headFill;
  const line = paint.faceLine(unit, icon);
  return (
    <G testID="mascot-head">
      {shape.ears.map(({ outer, inner }, i) => (
        <G key={i}>
          <Ellipse {...paint.ear(unit, icon)} cx={outer.cx} cy={outer.cy} rx={outer.rx} ry={outer.ry} transform={rotation(outer)} />
          <Ellipse {...paint.earInner} cx={inner.cx} cy={inner.cy} rx={inner.rx} ry={inner.ry} transform={rotation(inner)} />
        </G>
      ))}
      {shape.leaf && <Path {...paint.leaf(unit, icon)} d={shape.leaf} />}
      {/* One outline round the group: a wide ink stroke under, the fills over it, so only the outer edge shows. */}
      <G testID="mascot-head-halo">
        {shape.puffs.map((c, i) => (
          <Circle key={i} {...paint.headHalo(unit, icon)} cx={c.cx} cy={c.cy} r={c.r} />
        ))}
      </G>
      <G testID="mascot-head-fill">
        {shape.puffs.map((c, i) => (
          <Circle key={i} {...fill} cx={c.cx} cy={c.cy} r={c.r} />
        ))}
      </G>
      {shape.crease && <Path {...paint.crease(unit)} d={shape.crease} />}
      {f && (
        <G testID="mascot-face">
          {f.blush.map((b, i) => (
            <Ellipse key={i} {...paint.blush} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} />
          ))}
          {f.eyeDots.map((e, i) => (
            <Circle key={i} {...paint.eye} cx={e.cx} cy={e.cy} r={e.r} />
          ))}
          {f.eyeArcs.map((d, i) => (
            <Path key={i} {...line} d={d} />
          ))}
          <Path {...line} d={f.mouthPath} />
        </G>
      )}
    </G>
  );
}

/** A head on its own, for the head picker's buttons: the same drawing at icon size (1 view-box unit = 1 pt). */
export function MascotHeadIcon({ kind }: { kind: HeadKind }) {
  return (
    <Svg viewBox="-15 -29.5 30 31" width={30} height={31} accessible={false} importantForAccessibility="no-hide-descendants">
      <MascotHead kind={kind} face="good" at={{ x: 0, bottom: 0, w: 10 }} unit={1} icon />
    </Svg>
  );
}
