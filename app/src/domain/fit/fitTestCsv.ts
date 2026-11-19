/**
 * The fit-test CSV (data/fit_tests.csv): one row per tester, garment and size,
 * with the app's prediction next to how it actually fit. Written by Test mode
 * in the app, read by `npm run fit:report`.
 */

export const FIT_TEST_COLUMNS = [
  'tester',
  'recorded_at',
  'garment_id',
  'size',
  'height_cm',
  'weight_kg',
  'sizing',
  'chest_cm',
  'chest_source',
  'torso_cm',
  'preference_source',
  'style',
  'anchor',
  /** The chest ease the verdict aimed for on this garment (cm). */
  'preferred_chest_ease_cm',
  /** Preferred top length − torso length (cm); blank without an anchor's length. */
  'preferred_length_diff_cm',
  'recommended_size',
  /** The likeliest verdict for this size (fits, snugger, roomier, …). */
  'predicted_verdict',
  'p_fits_how_you_like',
  /** Objective labels at the point estimate. */
  'predicted_chest_label',
  'predicted_length_label',
  'p_chest_too_tight',
  'p_chest_just_right',
  'p_chest_too_loose',
  'p_length_too_short',
  'p_length_just_right',
  'p_length_too_long',
  /** too-tight | just-right | too-loose */
  'actual_chest',
  /** too-short | just-right | too-long */
  'actual_length',
  /** The size they'd keep, or "none". */
  'kept_size',
] as const;

export type FitTestColumn = (typeof FIT_TEST_COLUMNS)[number];

/**
 * Parse CSV text into rows of fields. Handles quoted fields with commas, quotes
 * ("") and line breaks, and \n or \r\n line ends. Blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** Rows as objects keyed by the header. Throws if a required column is missing. */
export function readFitTestCsv(text: string): Record<FitTestColumn, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const missing = FIT_TEST_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) throw new Error(`fit_tests.csv is missing columns: ${missing.join(', ')}`);
  return rows.map((r) => Object.fromEntries(FIT_TEST_COLUMNS.map((c) => [c, r[header.indexOf(c)] ?? ''])) as Record<FitTestColumn, string>);
}
