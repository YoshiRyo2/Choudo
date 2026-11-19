/**
 * The `npm run data:check` report: every seed garment's checks, grade and audit,
 * as plain text. Pure — the script supplies the seed and whether snapshot files
 * exist on this machine.
 */

import { gradeGarment } from './grade';
import type { ConfidenceGrade, SeedGarment, SourceTier } from './types';
import { checkGarment, type GarmentCheck } from './verify';

export type SnapshotStatus = 'none' | 'present' | 'missing';

export interface ReportEntry {
  garment: SeedGarment;
  check: GarmentCheck;
  /** null = has errors, left out of the app. */
  grade: ConfidenceGrade | null;
  snapshot: SnapshotStatus;
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

/** Check and grade every garment. Duplicate ids are an error on the later garment. */
export function buildReport(garments: SeedGarment[], hasFile: (path: string) => boolean): ReportEntry[] {
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
    };
  });
}

export const errorCount = (entries: ReportEntry[]): number => entries.reduce((n, e) => n + e.check.errors.length, 0);

const cm = (v: number) => `${v.toFixed(1)} cm`;
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} cm`;

function formatEntry({ garment: g, check, grade, snapshot }: ReportEntry): string[] {
  const mark = check.errors.length > 0 ? '✗' : check.warnings.length > 0 ? '!' : '✓';
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
