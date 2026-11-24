/** @type {import('jest').Config} */
module.exports = {
  // jest-expo's own transformIgnorePatterns are kept. @choudo/core is a workspace link,
  // so Jest sees it at packages/core (outside node_modules) and transforms it anyway.
  preset: 'jest-expo/ios',
  setupFiles: ['<rootDir>/jest.setup.ts'],
};
