/**
 * The `npm run data:check` report: every seed garment's checks, grade, audit and
 * image, as plain text. Pure — the script supplies the seed, whether snapshot files
 * exist on this machine, and what it found for each image file.
 */

import { gradeGarment } from './grade';
import type { ConfidenceGrade, GarmentImage, SeedGarment, SourceTier } from './types';
import { checkGarment, type GarmentCheck } from './verify';
import { MIN_IMAGE_WIDTH_PX } from './verifyRules';

export type SnapshotStatus = 'none' | 'present' | 'missing';

/** What the script found on disk for an image under app/public. */
export interface ImageFileInfo {
  /** Pixel width, or null when the file isn't on this machine. */
  width: number | null;
  /** Left out by .gitignore, so a fresh clone (and the CI build) won't have it. */
  gitIgnored: boolean;
}

/**
 * A garment image's check. A `local-only` photo never ships, so it isn't checked.
 * Any other must be committed (not git-ignored), exist and be at least
 * MIN_IMAGE_WIDTH_PX wide, so a fresh clone and the public build show the same photos.
 */
export type ImageStatus =
  | { state: 'none' }
  | { state: 'ok'; file: string; width: number }
  | { state: 'local-only'; file: string; width: number | null }
  | { state: 'ignored'; file: string }
  | { state: 'missing'; file: string }
  | { state: 'too-small'; file: string; width: number };

export interface ReportEntry {
  garment: SeedGarment;
  check: GarmentCheck;
  /** null = has errors, left out of the app. */
  grade: ConfidenceGrade | null;
  snapshot: SnapshotStatus;
  /** An image problem is an error but doesn't block the garment: it draws in flat colour. */
  image: ImageStatus;
}

export const TIER_DESCRIPTION: Record<SourceTier, string> = {
  A: 'brand spec sheet',
  B: 'published garment chart',
  C: 'partner / print-on-demand API',
  D: 'retailer data',
  E: 'user-measured garment',
  F: 'body-size chart only',
  G: 'photo only',
};

function checkImage({ file, licence }: GarmentImage, info: ImageFileInfo): ImageStatus {
  if (licence === 'local-only') return { state: 'local-only', file, width: info.width };
  if (info.gitIgnored) return { state: 'ignored', file };
  if (info.width === null) return { state: 'missing', file };
  if (info.width < MIN_IMAGE_WIDTH_PX) return { state: 'too-small', file, width: info.width };
  return { state: 'ok', file, width: info.width };
}

const imageError = (image: ImageStatus): string | null =>
  image.state === 'ignored'
    ? `${image.file} is git-ignored, so a fresh clone and the public build won't have it: mark it "licence": "local-only" or commit it`
    : image.state === 'missing'
    ? `${image.file} is missing (it must be committed under app/public/)`
    : image.state === 'too-small'
      ? `${image.file} is ${image.width} px wide; it must be at least ${MIN_IMAGE_WIDTH_PX}`
      : null;

/**
 * Check and grade every garment. Duplicate ids are an error on the later garment.
 * `hasFile` is for snapshot paths (relative to app/); `imageFile` for image paths
 * (relative to app/public/).
 */
export function buildReport(
  garments: SeedGarment[],
  hasFile: (path: string) => boolean,
  imageFile: (path: string) => ImageFileInfo,
): ReportEntry[] {
  const seen = new Set<string>();
  return garments.map((garment) => {
    const check = checkGarment(garment);
    if (seen.has(garment.id)) check.errors.push({ check: 'structure', message: 'duplicate id' });
    seen.add(garment.id);
    const path = garment.source.snapshot;
    return {
      garment,
      check,
      grade: gradeGarment(garment, check),
      snapshot: path === undefined ? 'none' : hasFile(path) ? 'present' : 'missing',
      image: garment.image ? checkImage(garment.image, imageFile(garment.image.file)) : { state: 'none' },
    };
  });
}

export const errorCount = (entries: ReportEntry[]): number =>
  entries.reduce((n, e) => n + e.check.errors.length + (imageError(e.image) ? 1 : 0), 0);

function imageLine(image: ImageStatus): string | null {
  switch (image.state) {
    case 'none':
      return null;
    case 'ok':
      return `  Image:    ${image.file} (${image.width} px wide)`;
    case 'local-only':
      return `  Image:    ${image.file} (local-only, ${image.width === null ? 'not on this machine' : `${image.width} px wide`}; not checked)`;
    case 'ignored':
    case 'missing':
    case 'too-small':
      return `  Error   [image] ${imageError(image)}`;
  }
}

const cm = (v: number) => `${v.toFixed(1)} cm`;
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} cm`;

function formatEntry({ garment: g, check, grade, snapshot, image }: ReportEntry): string[] {
  const failed = check.errors.length > 0 || imageError(image) !== null;
  const mark = failed ? '✗' : check.warnings.length > 0 ? '!' : '✓';
  const lines = [`${mark} ${g.id} — ${g.brand} ${g.name}`];
  const src = g.source;
  const origin = src.placeholder
    ? 'placeholder (invented sample data)'
    : `tier ${src.tier} (${src.tier ? TIER_DESCRIPTION[src.tier] : '?'})${src.capturedOn ? `, captured ${src.capturedOn}` : ''}`;
  lines.push(`  Grade:    ${grade ?? 'BLOCKED — left out of the app'}`);
  lines.push(`  Source:   ${origin}`);
  if (snapshot !== 'none') {
    lines.push(`  Snapshot: ${src.snapshot} (${snapshot === 'present' ? 'on this machine' : 'MISSING on this machine — save a copy'})`);
  } else if (!src.placeholder) {
    lines.push('  Snapshot: none saved');
  }
  const imageText = imageLine(image);
  if (imageText) lines.push(imageText);
  if (check.errors.length === 0 && check.warnings.length === 0) lines.push('  Checks:   pass');
  for (const e of check.errors) lines.push(`  Error   [${e.check}] ${e.message}`);
  for (const w of check.warnings) lines.push(`  Warning [${w.check}] ${w.message}`);
  for (const z of check.unscorable) {
    lines.push(`  Not scored: ${z.key} — ${z.reason}${z.required ? '' : ' (optional zone)'}`);
  }
  if (check.audit) {
    const a = check.audit;
    lines.push(`  Audit:    size ${a.size}, measured ${a.measuredOn}${a.afterWash ? ', after washing' : ', unwashed'}`);
    for (const d of a.diffs) {
      lines.push(
        d.diffCm === null || d.chartCm === null
          ? `    ${d.key.padEnd(8)} audit ${cm(d.auditCm)} — ${d.note}`
          : `    ${d.key.padEnd(8)} chart ${cm(d.chartCm)}  audit ${cm(d.auditCm)}  ${signed(d.diffCm)}`,
      );
    }
  }
  return lines;
}

/** The whole report, ending in a one-line summary. */
export function formatReport(entries: ReportEntry[]): string {
  const warnings = entries.reduce((n, e) => n + e.check.warnings.length, 0);
  const errors = errorCount(entries);
  const grades = new Map<string, number>();
  for (const e of entries) grades.set(e.grade ?? 'blocked', (grades.get(e.grade ?? 'blocked') ?? 0) + 1);
  const gradeList = [...grades].map(([grade, n]) => `${n} ${grade}`).join(', ');
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [
    `Garment data check — ${plural(entries.length, 'garment')}`,
    '',
    ...entries.flatMap((e) => [...formatEntry(e), '']),
    `${plural(errors, 'error')}, ${plural(warnings, 'warning')}. Grades: ${gradeList}.`,
  ].join('\n');
}
