/**
 * A .ico file holding PNG images (supported by every current browser and Windows
 * since Vista): a 6-byte header, one 16-byte entry per image, then the PNGs.
 *
 * @param {{ side: number, png: Buffer }[]} images
 * @returns {Buffer}
 */
export function icoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { side, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(side >= 256 ? 0 : side, 0); // width (0 means 256)
    entry.writeUInt8(side >= 256 ? 0 : side, 1); // height
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}
