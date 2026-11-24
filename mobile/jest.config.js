/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo/ios',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Core ships TypeScript source; transform it like the app's own files.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@choudo/.*)',
  ],
};
