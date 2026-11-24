import { describe, expect, it } from 'vitest';
import { STAMP_SESSION_KEY, stampKey, stampLedger, type SessionStore } from './stampSeen';

const memoryStore = (): SessionStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('the stamp ledger', () => {
  it('lets each garment + size drop once', () => {
    const ledger = stampLedger(memoryStore());
    expect(ledger.claim(stampKey('tee', 'M'))).toBe(true);
    expect(ledger.claim(stampKey('tee', 'M'))).toBe(false);
    // Another size of the same garment, or the same size of another, is a new stamp.
    expect(ledger.claim(stampKey('tee', 'L'))).toBe(true);
    expect(ledger.claim(stampKey('dress', 'M'))).toBe(true);
  });

  it('remembers across ledgers on the same session storage (a remount, a reload)', () => {
    const store = memoryStore();
    expect(stampLedger(store).claim('tee|M')).toBe(true);
    expect(stampLedger(store).claim('tee|M')).toBe(false);
    expect(JSON.parse(store.data.get(STAMP_SESSION_KEY)!)).toEqual(['tee|M']);
  });

  it('starts again in a new session', () => {
    expect(stampLedger(memoryStore()).claim('tee|M')).toBe(true);
    expect(stampLedger(memoryStore()).claim('tee|M')).toBe(true);
  });

  it('falls back to memory when storage is missing, blocked or holds junk', () => {
    const none = stampLedger(null);
    expect(none.claim('tee|M')).toBe(true);
    expect(none.claim('tee|M')).toBe(false);

    const blocked = stampLedger({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    });
    expect(blocked.claim('tee|M')).toBe(true);
    expect(blocked.claim('tee|M')).toBe(false);

    const junk = memoryStore();
    junk.data.set(STAMP_SESSION_KEY, '{not json');
    expect(stampLedger(junk).claim('tee|M')).toBe(true);
  });
});
