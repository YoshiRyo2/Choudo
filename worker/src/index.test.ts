import { expect, it } from 'vitest';
import * as entry from './index';

it('the entry exports only the handler (the runtime refuses any other export)', () => {
  expect(Object.keys(entry)).toEqual(['default']);
  expect(typeof entry.default.fetch).toBe('function');
});
