import { describe, expect, it } from 'vitest';
import type { StorageLike } from './migrate';
import { readStored, writeStored } from './persist';

function memory(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('full');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const isNumber = (v: unknown): v is number => typeof v === 'number';

describe('readStored', () => {
  it('returns the fallback for a missing key', () => {
    expect(readStored(memory(), 'k', 7, isNumber)).toBe(7);
  });

  it('returns the fallback for broken JSON', () => {
    expect(readStored(memory({ k: '{not json' }), 'k', 7, isNumber)).toBe(7);
  });

  it('returns the fallback for a value that fails the guard', () => {
    expect(readStored(memory({ k: '"three"' }), 'k', 7, isNumber)).toBe(7);
  });

  it('returns the fallback without storage', () => {
    expect(readStored(null, 'k', 7, isNumber)).toBe(7);
  });

  it('returns the fallback when reading throws', () => {
    expect(readStored(throwing, 'k', 7, isNumber)).toBe(7);
  });

  it('returns the stored value when it passes the guard', () => {
    expect(readStored(memory({ k: '3' }), 'k', 7, isNumber)).toBe(3);
  });
});

describe('writeStored', () => {
  it('stores the value as JSON', () => {
    const s = memory();
    writeStored(s, 'k', { a: 1 });
    expect(s.data.get('k')).toBe('{"a":1}');
  });

  it('removes the key for null and undefined', () => {
    const s = memory({ a: '1', b: '2' });
    writeStored(s, 'a', null);
    writeStored(s, 'b', undefined);
    expect(s.data.has('a')).toBe(false);
    expect(s.data.has('b')).toBe(false);
  });

  it('does not throw when storage throws', () => {
    expect(() => writeStored(throwing, 'k', 1)).not.toThrow();
    expect(() => writeStored(throwing, 'k', null)).not.toThrow();
  });

  it('does nothing without storage', () => {
    expect(() => writeStored(null, 'k', 1)).not.toThrow();
  });
});
