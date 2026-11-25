import { useMemo } from 'react';
import { estimateBody, type BodyInput, type BodyModel } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import { catalogueFor, type CatalogueScope, type Garment } from '@choudo/core/domain/garments';
import { resolveOutfit } from '@choudo/core/ui-logic/state/outfit';
import type { Outfit, UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { useBody } from './use-body';
import { useCatalogue } from './use-catalogue';
import { useGarments } from './use-garments';
import { useOutfit } from './use-outfit';
import { usePreference } from './use-preference';
import { useUnits } from './use-units';
import { firstLook } from '@/utils/odds-log';

export interface Wardrobe {
  body: BodyInput;
  model: BodyModel;
  preference: PreferenceSpec;
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  catalogue: CatalogueScope;
  setCatalogue: (scope: CatalogueScope) => void;
  /** Every garment the app may show (useGarments: no samples in a store build). */
  garments: readonly Garment[];
  /** What the catalogue toggle shows for this body type. */
  shown: readonly Garment[];
  /** The stored outfit, resolved (resolveOutfit): never stale. */
  outfit: Outfit;
  setOutfit: (outfit: Outfit) => void;
}

/**
 * Everything stored that the Fitting room and its sheets read (web App.tsx's state for
 * FittingRoom), or null before a body is stored.
 */
export function useWardrobe(): Wardrobe | null {
  const [body] = useBody();
  const [units, setUnits] = useUnits();
  const preference = usePreference();
  const [catalogue, setCatalogue] = useCatalogue();
  const [saved, setOutfit] = useOutfit();
  // No sample rows in a store build: a stored sample is swapped, not shown (storage is left alone).
  const garments = useGarments();
  const model = useMemo(() => (body ? estimateBody(body) : null), [body]);
  const bodyType = body?.bodyType;
  const shown = useMemo(() => (bodyType ? catalogueFor(garments, bodyType, catalogue) : []), [garments, bodyType, catalogue]);
  // Development: on a first launch this works out the default sizes (their odds) for the top and bottom.
  const outfit = useMemo(
    () => (model ? firstLook('outfit defaults', () => resolveOutfit(saved, model, preference, shown, garments)) : saved),
    [saved, model, preference, shown, garments],
  );
  if (!body || !model) return null;
  return { body, model, preference, units, setUnits, catalogue, setCatalogue, garments, shown, outfit, setOutfit };
}
