import { describe, expect, it, vi } from 'vitest';
import { createTracker, track, TRACK_EVENTS, TRACKED_SESSION_KEY, type GoatCounter, type TrackerEnv, type TrackEvent } from './analytics';

/** A Web Storage stand-in. */
function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

/** A page with count.js already run (or not), and a <script> that can "load" later. */
function page({ loaded = true, script = true, session = memoryStore() as TrackerEnv['session'] } = {}) {
  const count = vi.fn<NonNullable<GoatCounter['count']>>();
  let goatcounter: GoatCounter | undefined = loaded ? { count } : undefined;
  const listeners: (() => void)[] = [];
  const env: TrackerEnv = {
    goatcounter: () => goatcounter,
    script: () => (script ? { addEventListener: (_type: string, fn: () => void) => void listeners.push(fn) } : null) as never,
    session,
  };
  return {
    count,
    track: createTracker(env),
    /** count.js arrives and runs. */
    load() {
      goatcounter = { count };
      for (const fn of listeners) fn();
    },
  };
}

describe('track', () => {
  it('sends the event name as an event path, not starting with "/"', () => {
    const p = page();
    p.track('fitting-room-opened');
    expect(p.count).toHaveBeenCalledExactlyOnceWith({ path: 'fitting-room-opened', event: true });
  });

  it('only knows the fixed events, none with a "/" or anything about a garment or size', () => {
    expect([...TRACK_EVENTS]).toEqual([
      'fitting-room-opened',
      'fit-details-opened',
      'discover-opened',
      'closet-opened',
      'garment-saved',
      'link-checked',
      'link-unsupported',
    ]);
    for (const event of TRACK_EVENTS) expect(event).toMatch(/^[a-z]+(-[a-z]+)+$/);
  });

  it('ignores a name that is not on the list', () => {
    const p = page();
    p.track('garment-saved:gildan-5000|M' as TrackEvent);
    expect(p.count).not.toHaveBeenCalled();
  });

  it('counts each event once per session, kept in session storage', () => {
    const session = memoryStore();
    const p = page({ session });
    p.track('discover-opened');
    p.track('discover-opened');
    p.track('closet-opened');
    expect(p.count).toHaveBeenCalledTimes(2);
    expect(JSON.parse(session.data.get(TRACKED_SESSION_KEY)!)).toEqual(['discover-opened', 'closet-opened']);
    // A reload in the same tab: a new tracker, the same session.
    const again = page({ session });
    again.track('discover-opened');
    expect(again.count).not.toHaveBeenCalled();
  });

  it('keeps the once-per-session record in memory when session storage is missing or throws', () => {
    for (const session of [
      null,
      {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    ]) {
      const p = page({ session });
      p.track('garment-saved');
      p.track('garment-saved');
      expect(p.count).toHaveBeenCalledTimes(1);
    }
  });

  it('does nothing without GoatCounter on the page (dev server, tests)', () => {
    const p = page({ loaded: false, script: false });
    expect(() => p.track('fitting-room-opened')).not.toThrow();
    p.load();
    expect(p.count).not.toHaveBeenCalled();
  });

  it('sends an event made while count.js is still loading once it arrives, once', () => {
    const p = page({ loaded: false });
    p.track('fitting-room-opened');
    p.track('fitting-room-opened');
    expect(p.count).not.toHaveBeenCalled();
    p.load();
    expect(p.count).toHaveBeenCalledExactlyOnceWith({ path: 'fitting-room-opened', event: true });
    p.track('fitting-room-opened');
    expect(p.count).toHaveBeenCalledTimes(1);
  });

  it('never throws when GoatCounter throws, and tries again next time', () => {
    const p = page();
    p.count.mockImplementationOnce(() => {
      throw new Error('count.js broke');
    });
    expect(() => p.track('closet-opened')).not.toThrow();
    p.track('closet-opened');
    expect(p.count).toHaveBeenCalledTimes(2);
  });

  it('never throws when the page itself throws', () => {
    const broken = createTracker({
      goatcounter: () => {
        throw new Error('no window');
      },
      script: () => {
        throw new Error('no document');
      },
      session: null,
    });
    expect(() => broken('fit-details-opened')).not.toThrow();
  });

  it('is a safe no-op here, under Vitest, where no window.goatcounter exists', () => {
    expect((globalThis as { goatcounter?: unknown }).goatcounter).toBeUndefined();
    expect(() => track('fitting-room-opened')).not.toThrow();
  });
});

describe('what the app sends', () => {
  /** The app's own source files (not tests, not this helper), by path. */
  const sources = Object.entries(
    import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!./analytics.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  );

  it('calls track only with a fixed event name, written out as a literal', () => {
    const args = sources.flatMap(([, text]) => [...text.matchAll(/\btrack\(([^)]*)\)/g)].map((m) => m[1]!.trim()));
    // FitSheet, Discover's like, App's tabs (looked up in a table of literals), and the Check tab's two.
    expect(args.sort()).toEqual(["'fit-details-opened'", "'garment-saved'", "'link-checked'", "'link-unsupported'", 'TAB_EVENTS[tab]']);
  });

  it('is the only place that talks to GoatCounter', () => {
    expect(sources.length).toBeGreaterThan(20);
    // window.goatcounter, goatcounter?.count, script[data-goatcounter] (the About text may name it).
    for (const [path, text] of sources) expect(text, path).not.toMatch(/\bgoatcounter\b\s*\??\.|data-goatcounter/);
  });
});
