/**
 * A synthetic pair of jeans laid flat, for tests only: landmark pixels of a
 * 900 × 1400 image. Straight legs, a little wider at the hip than the hem, the
 * knees half way from the crotch to the hem.
 */
import type { PantsLandmarkName } from '@choudo/core/domain/garments';
import type { XY } from './photoWarp';

export const SYNTHETIC_JEANS_PX = { width: 900, height: 1400 };

export const SYNTHETIC_JEANS_LANDMARKS: Record<PantsLandmarkName, XY> = {
  waistLeft: { x: 250, y: 100 },
  waistMid: { x: 450, y: 110 },
  waistRight: { x: 650, y: 100 },
  hipLeft: { x: 220, y: 300 },
  hipRight: { x: 680, y: 300 },
  crotch: { x: 450, y: 420 },
  kneeOuterLeft: { x: 250, y: 870 },
  kneeInnerLeft: { x: 420, y: 870 },
  kneeOuterRight: { x: 650, y: 870 },
  kneeInnerRight: { x: 480, y: 870 },
  hemOuterLeft: { x: 260, y: 1320 },
  hemInnerLeft: { x: 410, y: 1320 },
  hemOuterRight: { x: 640, y: 1320 },
  hemInnerRight: { x: 490, y: 1320 },
};

/** The outline of the synthetic jeans, clockwise as you look at them (the picker's place order). */
export const SYNTHETIC_JEANS_OUTLINE: (keyof typeof SYNTHETIC_JEANS_LANDMARKS)[] = [
  'waistLeft',
  'waistMid',
  'waistRight',
  'hipRight',
  'kneeOuterRight',
  'hemOuterRight',
  'hemInnerRight',
  'kneeInnerRight',
  'crotch',
  'kneeInnerLeft',
  'hemInnerLeft',
  'hemOuterLeft',
  'kneeOuterLeft',
  'hipLeft',
];
