/// <reference types="node" />
// The app's config as EAS and Expo resolve it (app.config.ts over app.json).

type Config = { extra?: { appVariant?: string }; ios?: { infoPlist?: Record<string, unknown> } };
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
