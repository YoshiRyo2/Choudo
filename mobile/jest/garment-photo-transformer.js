// Garment photos (app/public/garments/*.png) in tests: registered with the asset
// registry the way Metro does it, with the PNG's real pixel size, so
// Image.resolveAssetSource gives photoSource the width and height the warp needs.
// Other images keep jest-expo's stub.
const { readFileSync } = require('node:fs');
const path = require('node:path');

module.exports = {
  process: (_src, filename) => {
    const png = readFileSync(filename);
    // IHDR: width and height, big-endian, at bytes 16 and 20.
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const asset = {
      __packager_asset: true,
      httpServerLocation: '/assets/garments',
      name: path.basename(filename, '.png'),
      type: 'png',
      width,
      height,
      scales: [1],
      hash: '',
    };
    return {
      code: `module.exports = require('react-native/asset-registry').registerAsset(${JSON.stringify(asset)});`,
    };
  },
};
