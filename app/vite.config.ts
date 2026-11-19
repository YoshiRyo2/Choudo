/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { landmarksDevServer } from './dev/landmarksServer.ts';

export default defineConfig({
  plugins: [react(), landmarksDevServer()],
  server: { host: true }, // expose on LAN so you can open it on a phone
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
