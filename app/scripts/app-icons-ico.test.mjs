import { describe, expect, it } from 'vitest';
import { icoFromPngs } from './app-icons-ico.mjs';

describe('icoFromPngs', () => {
  it('writes a header, one entry per image pointing at its bytes, then the images', () => {
    const a = Buffer.from([1, 2, 3]);
    const b = Buffer.from([4, 5]);
    const ico = icoFromPngs([
      { side: 16, png: a },
      { side: 256, png: b },
    ]);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    // first entry: 16 px, 3 bytes, right after the header and both entries
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt32LE(6 + 8)).toBe(3);
    expect(ico.readUInt32LE(6 + 12)).toBe(38);
    // second entry: 256 px is written as 0
    expect(ico.readUInt8(22)).toBe(0);
    expect(ico.readUInt32LE(22 + 12)).toBe(41);
    expect([...ico.subarray(38)]).toEqual([1, 2, 3, 4, 5]);
  });
});
