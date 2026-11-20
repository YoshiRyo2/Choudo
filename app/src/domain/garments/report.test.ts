import { describe, expect, it } from 'vitest';
import { SEED_GARMENTS } from './garments';
import { buildReport, errorCount, formatReport, type ImageFileInfo } from './report';
import type { GarmentImage, SeedGarment } from './types';
import { MIN_IMAGE_WIDTH_PX } from './verifyRules';

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

/** Every image on disk and wide enough. */
const sharp = (): ImageFileInfo => ({ width: 900, localOnly: false });

describe('buildReport', () => {
  it('has no errors for the current seed', () => {
    expect(errorCount(buildReport([...SEED_GARMENTS], () => true, sharp))).toBe(0);
  });

  it('notes whether the snapshot is on this machine', () => {
    expect(buildReport([tee], () => true, sharp)[0]?.snapshot).toBe('present');
    expect(buildReport([tee], () => false, sharp)[0]?.snapshot).toBe('missing');
    expect(buildReport([{ ...tee, source: { placeholder: true } }], () => false, sharp)[0]?.snapshot).toBe('none');
  });

  it('counts a duplicate id as an error and leaves the garment ungraded', () => {
    const entries = buildReport([tee, tee], () => true, sharp);
    expect(errorCount(entries)).toBe(1);
    expect(entries[1]?.grade).toBeNull();
  });
});

describe('buildReport: garment images', () => {
  // Real landmarks (from a seed shirt) so the image passes the structural check.
  const seedImage = SEED_GARMENTS.find((g) => g.id === 'ryo-black-henley')!.image!;
  const photo: GarmentImage = { ...seedImage, file: 'garments/tee-front.png' };
  const withPhoto: SeedGarment = { ...tee, image: photo };
  const report = (info: ImageFileInfo) => buildReport([withPhoto], () => true, () => info)[0]!;

  it('has nothing to check for a garment without an image', () => {
    expect(buildReport([tee], () => true, sharp)[0]?.image).toEqual({ state: 'none' });
  });

  it('passes an image that exists and is wide enough', () => {
    const entry = report({ width: MIN_IMAGE_WIDTH_PX, localOnly: false });
    expect(entry.image).toEqual({ state: 'ok', file: photo.file, width: MIN_IMAGE_WIDTH_PX });
    expect(errorCount([entry])).toBe(0);
  });

  it('fails an image that is missing', () => {
    const entry = report({ width: null, localOnly: false });
    expect(entry.image.state).toBe('missing');
    expect(errorCount([entry])).toBe(1);
    // An image problem doesn't take the garment out of the app: it draws in flat colour.
    expect(entry.grade).toBe('charted');
  });

  it('fails an image narrower than the minimum', () => {
    const entry = report({ width: MIN_IMAGE_WIDTH_PX - 1, localOnly: false });
    expect(entry.image).toEqual({ state: 'too-small', file: photo.file, width: MIN_IMAGE_WIDTH_PX - 1 });
    expect(errorCount([entry])).toBe(1);
  });

  it('skips an image that is git-ignored on purpose, present or not', () => {
    expect(errorCount([report({ width: null, localOnly: true })])).toBe(0);
    expect(errorCount([report({ width: 556, localOnly: true })])).toBe(0);
    expect(report({ width: 556, localOnly: true }).image.state).toBe('local-only');
  });

  it('prints the image line and its error', () => {
    const ok = formatReport([report({ width: 900, localOnly: false })]);
    expect(ok).toContain('Image:    garments/tee-front.png (900 px wide)');
    const missing = formatReport([report({ width: null, localOnly: false })]);
    expect(missing).toContain('Error   [image] garments/tee-front.png is missing (it must be committed under app/public/)');
    expect(missing).toContain('✗ tee');
    expect(missing.split('\n').at(-1)).toBe('1 error, 0 warnings. Grades: 1 charted.');
    const small = formatReport([report({ width: 480, localOnly: false })]);
    expect(small).toContain(`Error   [image] garments/tee-front.png is 480 px wide; it must be at least ${MIN_IMAGE_WIDTH_PX}`);
    const local = formatReport([report({ width: null, localOnly: true })]);
    expect(local).toContain('Image:    garments/tee-front.png (git-ignored on purpose, not on this machine; not checked)');
  });
});

describe('formatReport', () => {
  it('prints grade, source, checks and a summary', () => {
    const text = formatReport(buildReport([tee], () => false, sharp));
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
    const text = formatReport(buildReport([shrinking, audited, unknown], () => true, sharp));
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
