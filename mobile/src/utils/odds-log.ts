/**
 * Development only: how long the first odds take on this phone (garmentOdds samples 500
 * times; Hermes has no JIT). Each key is logged once per launch, as `[odds] {key}: {ms} ms`.
 * A store build (and Jest, unless a test sets a log) does no timing at all.
 */
type Log = (line: string) => void;

let log: Log | null = __DEV__ && process.env.NODE_ENV !== 'test' ? (line) => console.log(line) : null;
const looked = new Set<string>();

/** Run `compute`, timing it if `key` hasn't been timed this launch. */
export function firstLook<T>(key: string, compute: () => T): T {
  if (!log || looked.has(key)) return compute();
  looked.add(key);
  const start = performance.now();
  const value = compute();
  log(`[odds] ${key}: ${Math.round(performance.now() - start)} ms`);
  return value;
}

/** Tests: where the lines go (null: no timing). */
export function setOddsLog(next: Log | null) {
  log = next;
}

/** Tests: time every key again, as after a relaunch. */
export function forgetFirstLooks() {
  looked.clear();
}
