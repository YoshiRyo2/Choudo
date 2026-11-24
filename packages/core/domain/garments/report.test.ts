import { describe, expect, it } from 'vitest';
import { SEED_GARMENTS } from './garments';
import { buildReport, errorCount, formatReport, type ImageFileInfo } from './report';
import type { GarmentImage, SeedGarment } from './types';
import { MIN_IMAGE_WIDTH_PX } from './verifyRules';
import { TEE_BACK_IMAGE } from './testFixtures';

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
const sharp = (): ImageFileInfo => ({ width: 900, gitIgnored: false });

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
    const entry = report({ width: MIN_IMAGE_WIDTH_PX, gitIgnored: false });
    expect(entry.image).toEqual({ state: 'ok', file: photo.file, width: MIN_IMAGE_WIDTH_PX });
    expect(errorCount([entry])).toBe(0);
  });

  it('fails an image that is missing', () => {
    const entry = report({ width: null, gitIgnored: false });
    expect(entry.image.state).toBe('missing');
    expect(errorCount([entry])).toBe(1);
    // An image problem doesn't take the garment out of the app: it draws in flat colour.
    expect(entry.grade).toBe('charted');
  });

  it('fails an image narrower than the minimum', () => {
    const entry = report({ width: MIN_IMAGE_WIDTH_PX - 1, gitIgnored: false });
    expect(entry.image).toEqual({ state: 'too-small', file: photo.file, width: MIN_IMAGE_WIDTH_PX - 1 });
    expect(errorCount([entry])).toBe(1);
  });

  const localOnly: SeedGarment = { ...withPhoto, image: { ...photo, licence: 'local-only' } };
  const reportLocal = (info: ImageFileInfo) => buildReport([localOnly], () => true, () => info)[0]!;

  it('skips a local-only photo, git-ignored or committed, present or not', () => {
    expect(reportLocal({ width: null, gitIgnored: true }).image.state).toBe('local-only');
    expect(errorCount([reportLocal({ width: null, gitIgnored: true })])).toBe(0);
    expect(reportLocal({ width: 900, gitIgnored: false }).image.state).toBe('local-only');
    expect(errorCount([reportLocal({ width: 556, gitIgnored: false })])).toBe(0);
  });

  it('fails a git-ignored photo whose licence lets it ship', () => {
    const entry = report({ width: 900, gitIgnored: true });
    expect(entry.image.state).toBe('ignored');
    expect(errorCount([entry])).toBe(1);
    expect(formatReport([entry])).toMatch(/git-ignored.*"licence": "local-only"/);
  });

  it('prints the image line and its error', () => {
    const ok = formatReport([report({ width: 900, gitIgnored: false })]);
    expect(ok).toContain('Image:    garments/tee-front.png (900 px wide)');
    const missing = formatReport([report({ width: null, gitIgnored: false })]);
    expect(missing).toContain('Error   [image] garments/tee-front.png is missing (it must be committed under app/public/)');
    expect(missing).toContain('✗ tee');
    expect(missing.split('\n').at(-1)).toBe('1 error, 0 warnings. Grades: 1 charted.');
    const small = formatReport([report({ width: 480, gitIgnored: false })]);
    expect(small).toContain(`Error   [image] garments/tee-front.png is 480 px wide; it must be at least ${MIN_IMAGE_WIDTH_PX}`);
    const local = formatReport([reportLocal({ width: null, gitIgnored: true })]);
    expect(local).toContain('Image:    garments/tee-front.png (local-only, not on this machine; not checked)');
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

describe('buildReport: back photos', () => {
  const front: GarmentImage = { ...SEED_GARMENTS.find((g) => g.id === 'ryo-black-henley')!.image!, file: 'garments/tee-front.png' };
  const withBack = (licence: GarmentImage['licence']): SeedGarment => ({
    ...tee,
    image: front,
    backImage: { ...TEE_BACK_IMAGE, file: 'garments/tee-back.png', licence },
  });
  const files = (back: ImageFileInfo) => (file: string) => (file === 'garments/tee-back.png' ? back : sharp());

  it('checks a back photo like a front one', () => {
    const entries = buildReport([withBack('own')], () => true, files({ width: null, gitIgnored: false }));
    expect(entries[0]!.backImage).toEqual({ state: 'missing', file: 'garments/tee-back.png' });
    expect(errorCount(entries)).toBe(1);
    expect(formatReport(entries)).toContain('Error   [backImage] garments/tee-back.png is missing');
  });

  it('a local-only back photo is not checked', () => {
    const entries = buildReport([withBack('local-only')], () => true, files({ width: null, gitIgnored: true }));
    expect(errorCount(entries)).toBe(0);
    expect(formatReport(entries)).toContain('  Back:     garments/tee-back.png (local-only, not on this machine; not checked)');
  });

  it('lists a back photo that passes under the front one', () => {
    const text = formatReport(buildReport([withBack('own')], () => true, sharp));
    expect(text).toContain('  Image:    garments/tee-front.png (900 px wide)\n  Back:     garments/tee-back.png (900 px wide)');
  });

  it('has no back photo to check by default', () => {
    expect(buildReport([tee], () => true, sharp)[0]!.backImage).toEqual({ state: 'none' });
  });
});
