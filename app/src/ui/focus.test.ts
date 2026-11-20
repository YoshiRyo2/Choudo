import { describe, expect, it } from 'vitest';
import { clickedByPointer } from './focus';

describe('clickedByPointer', () => {
  it('is true for a tap or mouse click (detail counts the clicks)', () => {
    expect(clickedByPointer({ detail: 1 })).toBe(true);
    expect(clickedByPointer({ detail: 2 })).toBe(true);
  });

  it('is false for Enter or Space on a button (detail 0)', () => {
    expect(clickedByPointer({ detail: 0 })).toBe(false);
  });
});
