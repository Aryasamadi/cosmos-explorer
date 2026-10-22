import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolveBase } from './src/config/basePath.ts';

export default defineConfig({
  base: resolveBase(process.env),
  plugins: [react()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/astronomy-engine')) return 'astronomy';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    clearMocks: true,
    maxWorkers: 4,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
