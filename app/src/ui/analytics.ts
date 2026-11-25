/**
 * Anonymous step counts with GoatCounter, so we can see how far people get. The production
 * build loads GoatCounter's script (build/goatCounter.ts), which counts the page view by
 * itself; `track` adds one of the fixed events below. It never sends anything else: no
 * body numbers, sizes, garments or stored data, and the names never carry any of them.
 *
 * Each event counts at most once per session (sessionStorage, in memory when that's
 * blocked). Where GoatCounter isn't loaded (dev server, tests, an ad blocker) `track`
 * does nothing; one called while the script is still loading is sent when it arrives.
 */

export const TRACK_EVENTS = [
  'fitting-room-opened',
  'fit-details-opened',
  'discover-opened',
  'closet-opened',
  'garment-saved',
] as const;

export type TrackEvent = (typeof TRACK_EVENTS)[number];

export const TRACKED_SESSION_KEY = 'choudo.tracked.v1';

/** The part of count.js's `window.goatcounter` we use. */
export type GoatCounter = { count?: (vars: { path: string; event: boolean }) => void };

/** What a tracker needs from the page: replaced in tests. */
export type TrackerEnv = {
  /** `window.goatcounter`, once count.js has run. */
  goatcounter(): GoatCounter | undefined;
  /** count.js's <script>, while it may still be loading; null when the page has none. */
  script(): Pick<HTMLScriptElement, 'addEventListener'> | null;
  session: { getItem(key: string): string | null; setItem(key: string, value: string): void } | null;
};

export function createTracker(env: TrackerEnv) {
  const memory = new Set<string>();
  const waiting = new Set<TrackEvent>();
  let listening = false;

  const sent = (event: TrackEvent): boolean => {
    try {
      if (!env.session) throw new Error('No session storage');
      const raw: unknown = JSON.parse(env.session.getItem(TRACKED_SESSION_KEY) ?? '[]');
      return Array.isArray(raw) && raw.includes(event);
    } catch {
      return memory.has(event);
    }
  };
  const markSent = (event: TrackEvent) => {
    memory.add(event);
    try {
      if (!env.session) return;
      const raw: unknown = JSON.parse(env.session.getItem(TRACKED_SESSION_KEY) ?? '[]');
      const list = Array.isArray(raw) ? raw.filter((e) => typeof e === 'string') : [];
      env.session.setItem(TRACKED_SESSION_KEY, JSON.stringify([...list, event]));
    } catch {
      // kept in memory
    }
  };

  /** Sends now if count.js is ready; false when it isn't (or it threw). */
  const send = (event: TrackEvent): boolean => {
    try {
      const count = env.goatcounter()?.count;
      if (typeof count !== 'function') return false;
      count({ path: event, event: true });
      markSent(event);
      return true;
    } catch {
      return false;
    }
  };

  const flush = () => {
    for (const event of waiting) if (!sent(event)) send(event);
    waiting.clear();
  };

  return function track(event: TrackEvent): void {
    try {
      if (!TRACK_EVENTS.includes(event) || sent(event) || send(event)) return;
      const script = env.script();
      if (!script) return; // no GoatCounter on this page
      waiting.add(event);
      if (!listening) {
        listening = true;
        script.addEventListener('load', flush, { once: true });
      }
    } catch {
      // counting must never break the app
    }
  };
}

const browserEnv: TrackerEnv = {
  goatcounter: () => (globalThis as { goatcounter?: GoatCounter }).goatcounter,
  script: () => globalThis.document?.querySelector<HTMLScriptElement>('script[data-goatcounter]') ?? null,
  session: (() => {
    try {
      return globalThis.sessionStorage ?? null;
    } catch {
      return null;
    }
  })(),
};

/** Counts one of the fixed steps, at most once per session. Never throws. */
export const track = createTracker(browserEnv);
