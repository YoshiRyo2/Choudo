import { useMemo } from 'react';
import { estimateBody, type BodyInput, type BodyModel } from '@choudo/core/domain/body';
import type { PreferenceSpec, UnderLayer } from '@choudo/core/domain/fit';
import { catalogueFor, findGarment, GARMENTS, type CatalogueScope, type Garment } from '@choudo/core/domain/garments';
import { resolveOutfit } from '@choudo/core/ui-logic/state/outfit';
import type { Outfit, UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { useBody } from './use-body';
import { useCatalogue } from './use-catalogue';
import { useOutfit } from './use-outfit';
import { usePreference } from './use-preference';
import { useUnits } from './use-units';

export interface Wardrobe {
  body: BodyInput;
  model: BodyModel;
  preference: PreferenceSpec;
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  catalogue: CatalogueScope;
  setCatalogue: (scope: CatalogueScope) => void;
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
  const model = useMemo(() => (body ? estimateBody(body) : null), [body]);
  const bodyType = body?.bodyType;
  const shown = useMemo(() => (bodyType ? catalogueFor(GARMENTS, bodyType, catalogue) : []), [bodyType, catalogue]);
  const outfit = useMemo(() => (model ? resolveOutfit(saved, model, preference, shown) : saved), [saved, model, preference, shown]);
  if (!body || !model) return null;
  return { body, model, preference, units, setUnits, catalogue, setCatalogue, shown, outfit, setOutfit };
}

/** What a jacket is fitted over: the outfit's top, or its dress (domain/fit/layers.ts). */
export function underLayer(outfit: Outfit): UnderLayer | undefined {
  const id = outfit.topId ?? outfit.onepieceId;
  const size = outfit.topId ? outfit.topSize : outfit.onepieceSize;
  const garment = id ? findGarment(id) : undefined;
  return garment && size ? { garment, sizeLabel: size } : undefined;
}
