/// <reference types="node" />
// The app's config as EAS and Expo resolve it (app.config.ts over app.json).

type Config = { extra?: { appVariant?: string }; ios?: { infoPlist?: Record<string, unknown>; privacyManifests?: Record<string, unknown>; bundleIdentifier?: string; supportsTablet?: boolean }; version?: string };
const resolve = (): Config => {
  const app = require('../../app.json') as { expo: Config };
  const configure = (require('../../app.config') as { default: (ctx: { config: Config }) => Config }).default;
  return configure({ config: app.expo });
};

const saved = process.env.APP_VARIANT;
afterEach(() => {
  if (saved === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = saved;
});

test('without APP_VARIANT it is a production build (Test mode off)', () => {
  delete process.env.APP_VARIANT;
  expect(resolve().extra?.appVariant).toBe('production');
});

test('the preview profile sets the preview variant', () => {
  process.env.APP_VARIANT = 'preview';
  expect(resolve().extra?.appVariant).toBe('preview');
});

test('store settings: no encryption of its own, no tracking, no data collected', () => {
  const config = resolve();
  expect(config.version).toBe('1.0.0');
  expect(config.ios?.bundleIdentifier).toBe('com.choudo.app');
  expect(config.ios?.supportsTablet).toBe(false);
  expect(config.ios?.infoPlist).toMatchObject({ ITSAppUsesNonExemptEncryption: false });
  expect(config.ios?.privacyManifests).toEqual({ NSPrivacyTracking: false, NSPrivacyTrackingDomains: [], NSPrivacyCollectedDataTypes: [] });
});

test('eas.json: the preview build turns Test mode on, production numbers its builds', () => {
  const eas = require('../../eas.json') as { cli: Record<string, unknown>; build: Record<string, { env?: Record<string, string>; autoIncrement?: boolean; distribution?: string }> };
  expect(eas.cli.appVersionSource).toBe('remote');
  expect(eas.build.preview).toMatchObject({ distribution: 'internal', env: { APP_VARIANT: 'preview' } });
  expect(eas.build.production?.autoIncrement).toBe(true);
  expect(eas.build.production?.env?.APP_VARIANT ?? 'production').toBe('production');
});
