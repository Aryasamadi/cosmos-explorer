import { defineConfig } from '@playwright/test';

/**
 * Phase-0 diagnostics are intentionally separate from the production E2E
 * gate. Visual baselines are platform-specific and are generated and reviewed
 * locally before being used for regression comparison.
 */
export default defineConfig({
  testDir: './diagnostics',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02,
      threshold: 0.25,
    },
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/diagnostics',
  snapshotPathTemplate: '{testDir}/baselines/{platform}/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
