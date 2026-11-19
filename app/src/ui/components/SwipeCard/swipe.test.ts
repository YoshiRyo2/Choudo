import { describe, expect, it } from 'vitest';
import { MAX_TILT, swipeOutcome, tilt } from './swipe';

describe('swipeOutcome', () => {
  const width = 300;

  it('likes on a long drag right and passes on a long drag left', () => {
    expect(swipeOutcome(100, 0, width)).toBe('like');
    expect(swipeOutcome(-100, 0, width)).toBe('pass');
  });

  it('snaps back on a short, slow drag', () => {
    expect(swipeOutcome(60, 0.1, width)).toBeNull();
    expect(swipeOutcome(0, 0, width)).toBeNull();
  });

  it('accepts a quick flick in the same direction', () => {
    expect(swipeOutcome(40, 0.8, width)).toBe('like');
    expect(swipeOutcome(-40, -0.8, width)).toBe('pass');
  });

  it('ignores a flick back the other way, or too tiny to mean it', () => {
    expect(swipeOutcome(40, -0.8, width)).toBeNull();
    expect(swipeOutcome(10, 2, width)).toBeNull();
  });
});

describe('tilt', () => {
  it('leans with the drag and is capped', () => {
    expect(tilt(150, 300)).toBeCloseTo(MAX_TILT / 2);
    expect(tilt(-900, 300)).toBe(-MAX_TILT);
    expect(tilt(10, 0)).toBe(0);
  });
});
