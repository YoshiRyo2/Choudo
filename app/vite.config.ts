/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { leaveOutLocalPhotos } from './build/leaveOutLocalPhotos.ts';
import { PAGES_BASE } from './build/pagesBase.ts';
import { landmarksDevServer } from './dev/landmarksServer.ts';

export default defineConfig(({ command, isPreview }) => ({
  // The dev server stays at /; the build, and vite preview of it, are for GitHub Pages.
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [react(), landmarksDevServer(), leaveOutLocalPhotos()],
  server: { host: true }, // expose on LAN so you can open it on a phone
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
}));
