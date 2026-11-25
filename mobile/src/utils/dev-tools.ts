import Constants from 'expo-constants';

/**
 * Test mode (and its panel) shows in development and in the fit-test build (eas.json's
 * "preview" profile sets APP_VARIANT), never in a store build. The mannequin lab stays
 * development only.
 */
export const DEV_TOOLS: boolean = __DEV__ || Constants.expoConfig?.extra?.appVariant === 'preview';
