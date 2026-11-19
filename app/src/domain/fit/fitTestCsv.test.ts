import { describe, expect, it } from 'vitest';
import { FIT_TEST_COLUMNS, parseCsv, readFitTestCsv } from './fitTestCsv';

describe('parseCsv', () => {
  it('splits plain fields and lines, skipping blank lines', () => {
    expect(parseCsv('a,b\n1,2\r\n\n3,\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', ''],
    ]);
  });

  it('handles quotes, commas and line breaks inside quotes', () => {
    expect(parseCsv('"a, b","say ""hi""","two\nlines"\nx,y,z')).toEqual([
      ['a, b', 'say "hi"', 'two\nlines'],
      ['x', 'y', 'z'],
    ]);
  });

  it('reads a last line without a line end', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('readFitTestCsv', () => {
  it('keys rows by column, in any column order', () => {
    const header = [...FIT_TEST_COLUMNS].reverse();
    const row = header.map((c) => (c === 'tester' ? 'T01' : c === 'size' ? 'M' : ''));
    const [r] = readFitTestCsv(`${header.join(',')}\n${row.join(',')}\n`);
    expect(r?.tester).toBe('T01');
    expect(r?.size).toBe('M');
  });

  it('a header-only file has no rows; a missing column is an error', () => {
    expect(readFitTestCsv(`${FIT_TEST_COLUMNS.join(',')}\n`)).toEqual([]);
    expect(() => readFitTestCsv('tester,size\nT01,M\n')).toThrow(/missing columns/);
  });
});
