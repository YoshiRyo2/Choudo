/** @type {import('jest').Config} */
const expo = require('jest-expo/ios/jest-preset');

module.exports = {
  // jest-expo's own transformIgnorePatterns are kept. @choudo/core is a workspace link,
  // so Jest sees it at packages/core (outside node_modules) and transforms it anyway.
  preset: 'jest-expo/ios',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transform: {
    // Listed first, so it wins over the preset's image stub (jest/garment-photo-transformer.js).
    '/app/public/garments/.+\\.png$': '<rootDir>/jest/garment-photo-transformer.js',
    ...expo.transform,
  },
};
