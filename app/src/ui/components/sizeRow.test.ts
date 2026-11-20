import { describe, expect, it } from 'vitest';
import { centredScrollLeft } from './sizeRow';

// A 300 px wide row that scrolls to 600 px; chips are measured from the row's content start.
const row = { clientWidth: 300, scrollWidth: 600 };

describe('centredScrollLeft', () => {
  it('centres a chip in the middle of the row', () => {
    expect(centredScrollLeft(row, { offsetLeft: 280, width: 60 })).toBe(160); // 280 + 30 − 150
  });

  it('never scrolls before the start', () => {
    expect(centredScrollLeft(row, { offsetLeft: 20, width: 60 })).toBe(0);
  });

  it('never scrolls past the end', () => {
    expect(centredScrollLeft(row, { offsetLeft: 560, width: 40 })).toBe(300);
  });

  it('stays at 0 when everything fits', () => {
    expect(centredScrollLeft({ clientWidth: 300, scrollWidth: 300 }, { offsetLeft: 200, width: 60 })).toBe(0);
  });
});
