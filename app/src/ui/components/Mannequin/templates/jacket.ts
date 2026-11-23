/**
 * A jacket or coat on the mannequin, hanging off whatever is worn under it.
 *
 * The jacket is drawn by the top drawing (topShape) on an envelope: the body
 * grown to the drawn outline of the top under it, plus that top's bulk
 * (domain/fit/layers.ts, the same number the fit adds). Its chest ease is taken
 * against the body plus the layer, as the fit engine compares it. So a jacket
 * over a roomy hoodie is drawn over the hoodie, never through it, and a hoodie
 * longer than the jacket shows below its hem because it was drawn first.
 * Closed for now: a placket down the centre front and a stand collar (from the
 * back: the collar band only).
 *
 * Pure functions, no React. Right side (+x) is built and mirrored for the left.
 */

import type { BodyMeasurements } from '../../../../domain/body';
import { layerAllowanceCm, layerGrowCm, type UnderLayer } from '../../../../domain/fit';
import type { Garment, SizeMeasurements } from '../../../../domain/garments';
import { bodyHalfAt, limbFrame, limbHalf, limbPath, mirrorPath, smoothPath, xAt, type BodyGeometry, type Pt } from '../geometry';
import { topShape, type TopShape } from '../topShape';
import type { View } from '../view';

/** Skin only: how far the stand collar rises above the neck base, cm. */
const COLLAR_RISE_CM = 3.5;

/** How far a point stands out from the arm's surface (cm), measured square to the arm. */
function padOffArm(g: BodyGeometry, p: Pt): number {
  const f = limbFrame(g.arm);
  const dx = p.x - g.arm.top.x;
  const dy = p.y - g.arm.top.y;
  const along = dx * f.dir.x + dy * f.dir.y;
  const across = dx * f.normal.x + dy * f.normal.y;
  return Math.max(0, across - limbHalf(g.arm, along / f.len));
}

/**
 * The body as the next layer sees it: from the shoulders to the hem of the top
 * under it, the wider of the body and that top's side seam, plus `growCm`;
 * the body itself below that hem. A long sleeve widens the arm the same way.
 * With nothing under it, the body unchanged.
 */
export function envelopeGeometry(
  g: BodyGeometry,
  under: { shape: TopShape; garment: Pick<Garment, 'sleeve'> } | null,
  growCm: number,
): BodyGeometry {
  if (!under) return g;
  const { shape } = under;
  const side = shape.right.sideSeam;
  const hemY = side[side.length - 1]!.y;
  const torsoEnd = g.y.crotch;
  const xEnv = (y: number): number => {
    const body = bodyHalfAt(g, y);
    if (y > hemY) return body;
    return Math.max(body, y >= side[0]!.y ? xAt(side, y) : 0) + growCm;
  };
  // Every height the body or the top's side changes direction at, plus a step back to the body at the hem.
  const ys = [...g.outline.map((p) => p.y), ...side.map((p) => p.y).filter((y) => y <= torsoEnd)];
  if (hemY < torsoEnd) ys.push(hemY + 0.01);
  const outline: Pt[] = [...new Set(ys)].sort((a, b) => a - b).map((y) => ({ x: xEnv(y), y }));

  const long = under.garment.sleeve === 'long';
  const arm = long
    ? {
        ...g.arm,
        halfTop: g.arm.halfTop + padOffArm(g, shape.right.sleeveOuterMid) + growCm,
        halfBottom: g.arm.halfBottom + padOffArm(g, shape.right.sleeveOuterEnd) + growCm,
      }
    : g.arm;

  return {
    ...g,
    outline,
    arm,
    half: {
      ...g.half,
      shoulder: Math.max(g.half.shoulder, shape.right.seam.x) + growCm,
      chest: xEnv(g.y.chest),
      waist: xEnv(g.y.waist),
      hip: xEnv(g.y.hip),
    },
  };
}

export interface JacketShape extends TopShape {
  /** The closed front: a line down the centre from the neck to the hem (stroke only). */
  /** The closed front's centre line (open path); null from the back. */
  placket: string | null;
  /** A stand collar round the neck (closed path, drawn over the body). */
  collar: string;
}

/** How a jacket hangs on this body, over `under` (the top drawn beneath it) when there is one. */
export function jacketShape(
  g: BodyGeometry,
  body: BodyMeasurements,
  garment: Garment,
  size: SizeMeasurements,
  under: { shape: TopShape; layer: UnderLayer } | null,
  /** Which side to draw; `under.shape` should be drawn from the same side. */
  view: View = 'front',
): JacketShape {
  const envelope = envelopeGeometry(
    g,
    under ? { shape: under.shape, garment: under.layer.garment } : null,
    under ? layerGrowCm(under.layer.garment) : 0,
  );
  const chestCm = body.chestCm + (under ? layerAllowanceCm(body, under.layer).chestCm : 0);
  const shape = topShape(envelope, garment, size, chestCm, body, { view });

  const neckFront = shape.landmarks.neckFront;
  const hemY = shape.markers.length?.y ?? shape.right.hem.y;
  const back = view === 'back';
  const placket = back ? null : smoothPath([{ x: 0, y: neckFront.y }, { x: 0, y: hemY - 0.3 }], false);
  const nx = g.half.neck;
  // From the back the stand collar is a plain band; from the front it closes in a point at the neck.
  const collar = smoothPath(
    [
      { x: nx + 1.2, y: g.y.neckBase + 1.2, corner: true },
      { x: nx + 0.9, y: g.y.neckBase - COLLAR_RISE_CM, corner: true },
      { x: -(nx + 0.9), y: g.y.neckBase - COLLAR_RISE_CM, corner: true },
      { x: -(nx + 1.2), y: g.y.neckBase + 1.2, corner: true },
      ...(back ? [] : [{ x: 0, y: neckFront.y }]),
    ],
    true,
  );
  // The bare forearm below the cuff is the body's own arm (skin rule), not the grown
  // envelope's, and it starts below whichever cuff ends lower: a longer cuff under the
  // jacket stays visible, as the layer note says.
  const underEndT = under && under.layer.garment.sleeve === 'long' ? under.shape.right.sleeveEndT : 0;
  const fromT = underEndT > shape.right.sleeveEndT ? Math.min(underEndT, 1.02) : Math.min(shape.right.sleeveEndT - 0.04, 1.02);
  const forearm = limbPath(g.arm, fromT, 1.1, 0, 0);
  return { ...shape, arms: [forearm, mirrorPath(forearm)], placket, collar };
}
