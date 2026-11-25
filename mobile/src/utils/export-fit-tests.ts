import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { csvFileName, fitTestsCsv } from '@choudo/core/ui-logic/state/fitTests';
import type { FitTestRecord } from '@choudo/core/ui-logic/state/stored';

/**
 * Test mode's results as the web's CSV (core's fitTestsCsv), written to the cache as
 * choudo-fit-tests-{date}.csv and handed to the share sheet, to AirDrop or mail for
 * data/fit_tests.csv.
 */
export async function exportFitTests(records: readonly FitTestRecord[], now = new Date()): Promise<void> {
  const name = csvFileName(now);
  const file = new File(Paths.cache, name);
  await file.write(fitTestsCsv(records));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: name });
}
