/**
 * Reading a chart's per-measurement settings: girth method, stretch and
 * definitions. Each can be given once for the whole garment or per measurement;
 * these helpers hide which.
 */

import type {
  DefinitionName,
  Definitions,
  Garment,
  GirthKey,
  GirthMethod,
  MeasurementKey,
  SeedGarment,
  Stretch,
} from './types';

type Chart = SeedGarment['chart'];

/** How the chart reports this girth. */
export function girthMethodOf(chart: Pick<Chart, 'girth'>, key: GirthKey): GirthMethod {
  return typeof chart.girth === 'string' ? chart.girth : (chart.girth[key] ?? chart.girth.default);
}

/** The garment-wide stretch (the default, for a per-measurement one). */
export function defaultStretch(stretch: SeedGarment['stretch']): Stretch {
  return typeof stretch === 'string' ? stretch : stretch.default;
}

/** The overrides of a per-measurement stretch (no `default`), or undefined for a garment-wide one. */
export function stretchOverrides(stretch: SeedGarment['stretch']): Partial<Record<MeasurementKey, Stretch>> | undefined {
  if (typeof stretch === 'string') return undefined;
  const { default: _default, ...overrides } = stretch;
  return overrides;
}

/** How much this measurement of a normalized garment stretches. */
export function stretchOf(garment: Pick<Garment, 'stretch' | 'stretchByKey'>, key: MeasurementKey): Stretch {
  return garment.stretchByKey?.[key] ?? garment.stretch;
}

/** Whether a normalized garment's chart says how this girth is measured. */
export function girthKnown(garment: Pick<Garment, 'girthVerified' | 'girthUnknown'>, key: GirthKey): boolean {
  return garment.girthUnknown ? !garment.girthUnknown.includes(key) : garment.girthVerified;
}

/** A seed chart's definition, from `definitions` or the older lengthDefinition / sleeveDefinition fields. */
export function chartDefinition<K extends DefinitionName>(chart: Chart, name: K): Definitions[K] | undefined {
  const fromDefinitions = chart.definitions?.[name];
  if (fromDefinitions !== undefined) return fromDefinitions;
  if (name === 'length') return chart.lengthDefinition as Definitions[K] | undefined;
  if (name === 'sleeve') return chart.sleeveDefinition as Definitions[K] | undefined;
  return undefined;
}

/** A normalized garment's definition, e.g. where its length is measured from. */
export function definitionOf<K extends DefinitionName>(
  garment: Pick<Garment, 'lengthDefinition' | 'sleeveDefinition' | 'definitions'>,
  name: K,
): Definitions[K] | undefined {
  if (name === 'length') return garment.lengthDefinition as Definitions[K] | undefined;
  if (name === 'sleeve') return garment.sleeveDefinition as Definitions[K] | undefined;
  return (garment.definitions as Definitions | undefined)?.[name];
}
