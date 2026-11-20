import { describe, expect, it } from 'vitest';
import {
  LEGACY_KEYS,
  migrateAppRename,
  migrateBodyV1,
  migrateFitTestsV1,
  migrateFitTestsV2,
  migrateStorage,
  oldNameOf,
  type StorageLike,
} from './migrate';
import { STORAGE_KEYS } from './stored';

/** A Storage stand-in backed by a Map. */
function memoryStorage(entries: Record<string, unknown> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const v1Body = { heightCm: 178, weightKg: 75, sizing: 'mens', overrides: { chestCm: 98 } };

describe('migrateBodyV1', () => {
  it('turns sizing into bodyType and keeps everything else', () => {
    expect(migrateBodyV1(v1Body)).toEqual({ heightCm: 178, weightKg: 75, bodyType: 'mens', overrides: { chestCm: 98 } });
  });

  it('keeps a women’s choice', () => {
    expect(migrateBodyV1({ ...v1Body, sizing: 'womens' })?.bodyType).toBe('womens');
  });

  it('puts a body with no or an odd sizing on men’s', () => {
    expect(migrateBodyV1({ heightCm: 178, weightKg: 75 })?.bodyType).toBe('mens');
    expect(migrateBodyV1({ heightCm: 178, weightKg: 75, sizing: 'kids' })?.bodyType).toBe('mens');
  });

  it('drops junk', () => {
    expect(migrateBodyV1(null)).toBeNull();
    expect(migrateBodyV1({ heightCm: 'tall', weightKg: 75, sizing: 'mens' })).toBeNull();
    expect(migrateBodyV1({ heightCm: 70, weightKg: 75, sizing: 'mens' })).toBeNull();
  });
});

const record = (body: unknown) => ({
  id: 'r1',
  tester: 'T01',
  at: '2026-11-18T10:00:00.000Z',
  garmentId: 'gildan-5000',
  size: 'M',
  chest: 'just-right',
  length: 'too-long',
  keptSize: 'M',
  prediction: {
    body,
    chestCm: 98,
    chestSource: 'estimated',
    torsoLengthCm: 73,
    preferenceSource: 'default',
    style: 'regular',
    anchor: '',
    preferredChestEaseCm: 5,
    preferredLengthDiffCm: null,
    recommendedSize: 'M',
    verdict: 'fits',
    likes: 0.6,
    chestLabel: 'fitted',
    lengthLabel: 'good',
    chest: { under: 0.2, right: 0.6, over: 0.2 },
    length: { under: 0.1, right: 0.8, over: 0.1 },
  },
});

describe('migrateFitTestsV1', () => {
  it('moves each prediction’s body and drops records that still don’t fit', () => {
    const out = migrateFitTestsV1([record(v1Body), record({ nope: true }), 'junk']);
    expect(out).toHaveLength(1);
    expect(out[0]?.prediction.body.bodyType).toBe('mens');
  });
});

describe('migrateStorage', () => {
  it('moves v1 to v2 and removes the old keys', () => {
    const s = memoryStorage({ [LEGACY_KEYS.bodyV1]: { ...v1Body, sizing: 'womens' }, [LEGACY_KEYS.fitTestsV1]: [record(v1Body)] });
    migrateStorage(s);
    expect(JSON.parse(s.data.get(STORAGE_KEYS.body)!)).toMatchObject({ bodyType: 'womens', heightCm: 178 });
    expect(JSON.parse(s.data.get(STORAGE_KEYS.fitTests)!)).toHaveLength(1);
    expect(s.data.has(LEGACY_KEYS.bodyV1)).toBe(false);
    expect(s.data.has(LEGACY_KEYS.fitTestsV1)).toBe(false);
  });

  it('never overwrites v2 data, and is safe to run twice', () => {
    const v2 = { heightCm: 160, weightKg: 55, bodyType: 'womens' };
    const s = memoryStorage({ [STORAGE_KEYS.body]: v2, [LEGACY_KEYS.bodyV1]: v1Body });
    migrateStorage(s);
    migrateStorage(s);
    expect(JSON.parse(s.data.get(STORAGE_KEYS.body)!)).toEqual(v2);
    expect(s.data.has(LEGACY_KEYS.bodyV1)).toBe(false);
  });

  it('writes nothing for unusable v1 data, and survives broken JSON and blocked storage', () => {
    const s = memoryStorage({ [LEGACY_KEYS.bodyV1]: { heightCm: 'x' } });
    s.data.set(LEGACY_KEYS.fitTestsV1, '{not json');
    migrateStorage(s);
    expect(s.data.has(STORAGE_KEYS.body)).toBe(false);
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(() => migrateStorage(blocked)).not.toThrow();
  });
});

describe('migrateAppRename (Nimbus -> Choudo)', () => {
  const body = { heightCm: 170, weightKg: 65, bodyType: 'womens' };
  const newer = { heightCm: 182, weightKg: 80, bodyType: 'mens' };

  it('names each old key after the new one', () => {
    expect(oldNameOf(STORAGE_KEYS.body)).toBe('nimbus.body.v2');
    expect(Object.values(STORAGE_KEYS).every((k) => k.startsWith('choudo.'))).toBe(true);
  });

  it('old data only: copies every key over, exactly as stored, and deletes the old keys', () => {
    const s = memoryStorage({
      'nimbus.body.v2': body,
      'nimbus.units.v1': 'imperial',
      'nimbus.swipes.v1': [{ garmentId: 'gildan-5000', sizeShown: 'M', liked: true, at: '2026-11-18T10:00:00.000Z' }],
    });
    const rawSwipes = s.data.get('nimbus.swipes.v1');
    migrateAppRename(s);
    expect(JSON.parse(s.data.get(STORAGE_KEYS.body)!)).toEqual(body);
    expect(JSON.parse(s.data.get(STORAGE_KEYS.units)!)).toBe('imperial');
    expect(s.data.get(STORAGE_KEYS.swipes)).toBe(rawSwipes);
    expect([...s.data.keys()].some((k) => k.startsWith('nimbus.'))).toBe(false);
  });

  it('new data only: leaves it alone', () => {
    const s = memoryStorage({ [STORAGE_KEYS.body]: newer, [STORAGE_KEYS.testMode]: true });
    const before = new Map(s.data);
    migrateAppRename(s);
    expect(s.data).toEqual(before);
  });

  it('both present: keeps the new data and deletes the old key', () => {
    const s = memoryStorage({ 'nimbus.body.v2': body, [STORAGE_KEYS.body]: newer });
    migrateAppRename(s);
    expect(JSON.parse(s.data.get(STORAGE_KEYS.body)!)).toEqual(newer);
    expect(s.data.has('nimbus.body.v2')).toBe(false);
  });

  it('runs inside migrateStorage, before v1 -> v2, so a renamed v2 body still beats a v1 one', () => {
    const s = memoryStorage({ 'nimbus.body.v2': body, [LEGACY_KEYS.bodyV1]: v1Body });
    migrateStorage(s);
    migrateStorage(s);
    expect(JSON.parse(s.data.get(STORAGE_KEYS.body)!)).toEqual(body);
    expect([...s.data.keys()]).toEqual([STORAGE_KEYS.body]);
  });

  it('leaves unrelated keys alone', () => {
    const s = memoryStorage({ 'nimbus.unknown.v1': 1, 'other.app': 2 });
    migrateAppRename(s);
    expect([...s.data.keys()].sort()).toEqual(['nimbus.unknown.v1', 'other.app']);
  });
});

describe('migrateFitTestsV2', () => {
  const v2Body = { heightCm: 178, weightKg: 75, bodyType: 'mens' };

  it('migrates v2 fit tests to v3 as top results', () => {
    const out = migrateFitTestsV2([record(v2Body), 'junk']);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ category: 'top', chest: 'just-right', length: 'too-long' });
  });

  it('moves the stored v2 key to v3, and a v1 key still arrives as v3', () => {
    const s = memoryStorage({ [LEGACY_KEYS.fitTestsV2]: [record(v2Body)] });
    migrateStorage(s);
    expect(STORAGE_KEYS.fitTests).toBe('choudo.fitTests.v3');
    expect(JSON.parse(s.data.get(STORAGE_KEYS.fitTests)!)[0].category).toBe('top');
    expect(s.data.has(LEGACY_KEYS.fitTestsV2)).toBe(false);
    const old = memoryStorage({ [LEGACY_KEYS.fitTestsV1]: [record(v1Body)] });
    migrateStorage(old);
    expect(JSON.parse(old.data.get(STORAGE_KEYS.fitTests)!)[0].category).toBe('top');
  });

  it('moves a pre-rename v2 key too', () => {
    const s = memoryStorage({ 'nimbus.fitTests.v2': [record(v2Body)] });
    migrateStorage(s);
    expect(JSON.parse(s.data.get(STORAGE_KEYS.fitTests)!)).toHaveLength(1);
    expect(s.data.has('nimbus.fitTests.v2')).toBe(false);
  });
});
