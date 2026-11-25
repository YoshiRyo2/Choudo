/// <reference types="node" />
// Reads files on disk (the test runs in Node, not on the phone).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = join(__dirname, '../../assets');
const config = JSON.parse(readFileSync(join(__dirname, '../../app.json'), 'utf8')) as {
  expo: { icon: string; ios: { icon: string }; plugins: unknown[] };
};

/** Width, height and colour type from a PNG's IHDR chunk (2 = RGB, 6 = RGBA). */
function png(file: string) {
  const b = readFileSync(join(ASSETS, file));
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colourType: b[25] };
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test('the iOS icon is Choudo’s, 1024 px square with no alpha channel (App Store rule)', () => {
  expect(config.expo.ios.icon).toBe('./assets/images/icon.png');
  expect(png('images/icon.png')).toEqual({ width: 1024, height: 1024, colourType: 2 });
});

test('the splash is the mark on the app’s background, so it hands over without a flash', () => {
  const splash = config.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, Record<string, unknown>];
  expect(splash[1]).toMatchObject({ backgroundColor: '#fff4ee', image: './assets/images/splash-icon.png', imageWidth: 160 });
  expect(png('images/splash-icon.png')).toMatchObject({ width: 400, height: 400, colourType: 6 });
});

test('Android and web icons are drawn from the same masters', () => {
  expect(png('images/android-icon-foreground.png')).toMatchObject({ width: 512, height: 512 });
  expect(png('images/android-icon-background.png')).toMatchObject({ width: 512, height: 512 });
  expect(png('images/android-icon-monochrome.png')).toMatchObject({ width: 512, height: 512 });
  expect(png('images/favicon.png')).toMatchObject({ width: 48, height: 48 });
});

test('nothing of the template’s Expo logo is left', () => {
  for (const file of filesUnder(ASSETS)) {
    expect(file).not.toContain('expo.icon');
    expect(readFileSync(file).toString('latin1')).not.toContain('expo-symbol');
  }
});
