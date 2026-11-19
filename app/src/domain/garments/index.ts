export * from './types';
export {
  GARMENTS,
  findGarment,
  garmentsByCategory,
  normalizeGarment,
  validateSeed,
} from './garments';
export { normalizeMeasurements } from './normalize';
export { checkGarment } from './verify';
export type { AuditDiff, AuditResult, CheckIssue, GarmentCheck, UnscorableZone } from './verify';
export { gradeGarment } from './grade';
