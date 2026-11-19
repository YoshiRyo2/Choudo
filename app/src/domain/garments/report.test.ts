import { describe, expect, it } from 'vitest';
import { SEED_GARMENTS } from './garments';
import { buildReport, errorCount, formatReport } from './report';
import type { SeedGarment } from './types';

const tee: SeedGarment = {
  id: 'tee',
  brand: 'Test',
  name: 'Tee',
  category: 'top',
  type: 'tee',
  sizing: 'mens',
  color: '#000000',
  sleeve: 'short',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'in', girth: 'flat', lengthDefinition: 'hps' },
  source: { placeholder: false, tier: 'B', url: 'https://example.com', capturedOn: '2026-11-18', snapshot: 'chart-snapshots/tee.pdf' },
  sizes: [
    { label: 'M', measurements: { chest: 20, length: 29 } },
    { label: 'L', measurements: { chest: 22, length: 30 } },
  ],
};

describe('buildReport', () => {
  it('has no errors for the current seed', () => {
    expect(errorCount(buildReport([...SEED_GARMENTS], () => true))).toBe(0);
  });

  it('notes whether the snapshot is on this machine', () => {
    expect(buildReport([tee], () => true)[0]?.snapshot).toBe('present');
    expect(buildReport([tee], () => false)[0]?.snapshot).toBe('missing');
    expect(buildReport([{ ...tee, source: { placeholder: true } }], () => false)[0]?.snapshot).toBe('none');
  });

  it('counts a duplicate id as an error and leaves the garment ungraded', () => {
    const entries = buildReport([tee, tee], () => true);
    expect(errorCount(entries)).toBe(1);
    expect(entries[1]?.grade).toBeNull();
  });
});

describe('formatReport', () => {
  it('prints grade, source, checks and a summary', () => {
    const text = formatReport(buildReport([tee], () => false));
    expect(text).toContain('✓ tee — Test Tee');
    expect(text).toContain('Grade:    charted');
    expect(text).toContain('Source:   tier B (published garment chart), captured 2026-11-18');
    expect(text).toContain('MISSING on this machine');
    expect(text).toContain('Checks:   pass');
    expect(text.split('\n').at(-1)).toBe('0 errors, 0 warnings. Grades: 1 charted.');
  });

  it('prints errors, warnings, unscored zones and audit differences', () => {
    const shrinking = { ...tee, id: 'bad', sizes: [...tee.sizes].reverse() };
    const audited: SeedGarment = {
      ...tee,
      id: 'audited',
      audit: { measuredSize: 'M', measuredOn: '2026-11-18', afterWash: true, unit: 'in', measurements: { chest: 19, length: 29 } },
    };
    const unknown = { ...tee, id: 'unknown', chart: { ...tee.chart, girth: 'unknown' as const } };
    const text = formatReport(buildReport([shrinking, audited, unknown], () => true));
    expect(text).toContain('✗ bad');
    expect(text).toContain('Grade:    BLOCKED — left out of the app');
    expect(text).toContain('Error   [monotonic] chest drops from L');
    expect(text).toContain('! audited');
    expect(text).toContain('Audit:    size M, measured 2026-11-18, after washing');
    expect(text).toMatch(/chest {4}chart 101\.6 cm {2}audit 96\.5 cm {2}−5\.1 cm/);
    expect(text).toContain('Not scored: chest — chart doesn’t say flat or full circumference');
    expect(text).toMatch(/look like flat widths/);
    expect(text.split('\n').at(-1)).toBe('2 errors, 2 warnings. Grades: 1 blocked, 1 charted, 1 unscored.');
  });
});
