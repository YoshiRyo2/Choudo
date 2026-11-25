import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json, plus what depends on the build. APP_VARIANT comes from eas.json's profiles:
 * "preview" (the fit-test build) turns Test mode on; anything else is a production build.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    appVariant: process.env.APP_VARIANT ?? 'production',
  },
});
