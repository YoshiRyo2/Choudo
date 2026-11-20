/**
 * A synthetic pair of jeans laid flat, for tests only: landmark pixels of a
 * 900 × 1400 image. Straight legs, a little wider at the hip than the hem.
 */
import type { PantsLandmarkName } from '../../../domain/garments';
import type { XY } from './photoWarp';

export const SYNTHETIC_JEANS_PX = { width: 900, height: 1400 };

export const SYNTHETIC_JEANS_LANDMARKS: Record<PantsLandmarkName, XY> = {
  waistLeft: { x: 250, y: 100 },
  waistMid: { x: 450, y: 110 },
  waistRight: { x: 650, y: 100 },
  hipLeft: { x: 220, y: 300 },
  hipRight: { x: 680, y: 300 },
  crotch: { x: 450, y: 420 },
  kneeOuterLeft: { x: 250, y: 850 },
  kneeInnerLeft: { x: 420, y: 850 },
  kneeOuterRight: { x: 650, y: 850 },
  kneeInnerRight: { x: 480, y: 850 },
  hemOuterLeft: { x: 260, y: 1320 },
  hemInnerLeft: { x: 410, y: 1320 },
  hemOuterRight: { x: 640, y: 1320 },
  hemInnerRight: { x: 490, y: 1320 },
};
