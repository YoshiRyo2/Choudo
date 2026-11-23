import { describe, expect, it } from 'vitest';
import { devToolsOn } from './devTools';

describe('devToolsOn', () => {
  it('is on only in development, and only when switched on', () => {
    expect(devToolsOn(true, false)).toBe(false); // a stored "on" never shows in production
    expect(devToolsOn(true, true)).toBe(true);
    expect(devToolsOn(false, true)).toBe(false);
  });
});
