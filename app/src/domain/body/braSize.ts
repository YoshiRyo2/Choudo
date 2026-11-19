/**
 * Bra sizes: parse "34DD", and estimate the full bust from it.
 *
 * The rule of thumb (Ryo's spec): bust ≈ band + cup, in inches, where each cup
 * letter is one more inch (AA 0, A 1, B 2, C 3, D 4 ...). Band sizes are inches in
 * both the US and UK; the cup letters part ways after D:
 *   US: DD = E (5), DDD = F (6), G 7, H 8, I 9, J 10
 *   UK: DD 5, E 6, F 7, FF 8, G 9, GG 10, H 11, HH 12, J 13
 * Bras are cut differently by brand, so this is an estimate, never a measurement.
 */

import { inToCm } from '../units';
import type { BraSize, BraSystem } from './types';

const CUP_INCHES: Record<BraSystem, Record<string, number>> = {
  us: { AA: 0, A: 1, B: 2, C: 3, D: 4, DD: 5, E: 5, DDD: 6, F: 6, G: 7, H: 8, I: 9, J: 10 },
  uk: { AA: 0, A: 1, B: 2, C: 3, D: 4, DD: 5, E: 6, F: 7, FF: 8, G: 9, GG: 10, H: 11, HH: 12, J: 13 },
};

/** Band sizes we accept, in inches. */
export const BRA_BAND_LIMITS = { min: 26, max: 50 } as const;

/** The cup letters for a system, smallest first (for help text). */
export const cupLetters = (system: BraSystem): string[] => Object.keys(CUP_INCHES[system]);

/** Cup letters -> inches over the band, or undefined for letters this system doesn't use. */
export function cupInches(cup: string, system: BraSystem): number | undefined {
  return CUP_INCHES[system][cup.trim().toUpperCase()];
}

export type BraParse = { ok: true; value: BraSize } | { ok: false; message: string };

/** "34DD", "34 dd" or "34-DD" -> a bra size, or a friendly message saying what's wrong. */
export function parseBraSize(text: string, system: BraSystem): BraParse {
  const m = /^\s*(\d{2})\s*[- ]?\s*([a-zA-Z]{1,3})\s*$/.exec(text);
  if (!m) return { ok: false, message: 'Write a bra size like 34C: band number, then cup.' };
  const band = Number(m[1]);
  const cup = m[2]!.toUpperCase();
  const problem = braSizeProblem({ band, cup, system });
  return problem ? { ok: false, message: problem } : { ok: true, value: { band, cup, system } };
}

/** What's wrong with a bra size, or null when it's usable. */
export function braSizeProblem(bra: BraSize): string | null {
  if (!Number.isInteger(bra.band) || bra.band < BRA_BAND_LIMITS.min || bra.band > BRA_BAND_LIMITS.max) {
    return `Band should be between ${BRA_BAND_LIMITS.min} and ${BRA_BAND_LIMITS.max}.`;
  }
  if (cupInches(bra.cup, bra.system) === undefined) {
    return `${bra.cup} isn't a ${bra.system.toUpperCase()} cup size (${cupLetters(bra.system).join(', ')}).`;
  }
  return null;
}

/** Band and cup in inches. Assumes a valid size (see braSizeProblem). */
export function braInches(bra: BraSize): { bandIn: number; cupIn: number } {
  return { bandIn: bra.band, cupIn: cupInches(bra.cup, bra.system) ?? 0 };
}

/** Full bust estimated from a bra size, in cm: (band + cup) inches. */
export function bustFromBraCm(bra: BraSize): number {
  const { bandIn, cupIn } = braInches(bra);
  return inToCm(bandIn + cupIn);
}

/** "34DD (US)" */
export const braSizeText = (bra: BraSize): string => `${bra.band}${bra.cup} (${bra.system.toUpperCase()})`;
