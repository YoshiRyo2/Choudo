export * from './types';
export {
  GARMENTS,
  findGarment,
  garmentsByCategory,
  normalizeGarment,
  validateSeed,
} from './garments';
export { GIRTH_KEYS, isGirthKey, MEASUREMENT_KEYS, normalizeMeasurements } from './normalize';
export { chartDefinition, defaultStretch, definitionOf, girthKnown, girthMethodOf, stretchOf } from './chart';
export { checkGarment } from './verify';
export type { AuditDiff, AuditResult, CheckIssue, GarmentCheck, UnscorableZone } from './verify';
export { gradeGarment } from './grade';
export { CATALOGUE_SCOPES, catalogueFor, fitsBodyType } from './catalogue';
export { CATEGORY_SPECS, categorySpec, GARMENT_TYPES, isGarmentType, pantsLandmarks, templateOf, topLandmarks, TYPE_TEMPLATE } from './categories';
export type { CategoryChecks, CategorySpec, TemplateId } from './categories';
export type { CatalogueScope } from './catalogue';
