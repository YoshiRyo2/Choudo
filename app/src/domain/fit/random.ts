/**
 * A small seeded random number generator, so sampled fit odds are the same on
 * every render and in every test. Not for anything security-related.
 */

export type Rng = () => number;

/** mulberry32: a fast 32-bit generator. Returns numbers in [0, 1). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal draw (mean 0, SD 1), by the Box–Muller transform. */
export function normal(rng: Rng): number {
  // 1 − u keeps the log away from 0.
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * A seed for one named key's own stream: FNV-1a over the key's characters,
 * starting from the sampler seed. The same seed and key always give the same
 * stream, and each key gets a different one.
 */
export function keyedSeed(seed: number, key: string): number {
  let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
