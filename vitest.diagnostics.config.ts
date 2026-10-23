import { defineConfig } from 'vitest/config';

/**
 * Pure scientific and configuration diagnostics. These tests are deliberately
 * kept out of `npm run test:ci` because some encode known current defects with
 * `it.fails` and must not become a false production gate.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['diagnostics/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
