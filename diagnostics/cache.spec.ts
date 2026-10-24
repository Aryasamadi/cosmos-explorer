import { expect, test, chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OSM_CACHE_NAME,
  blockOsm,
  countCacheEntries,
  dismissHint,
  focusManualLocation,
  installFixedDate,
  installMockOsm,
  openApp,
  trackPageErrors,
  waitForMapError,
  waitForMapReady,
} from './helpers';

const CAIRO = { latitudeDeg: 30.0444, longitudeDeg: 31.2357 };

test.describe('tile and cache diagnostics', () => {
  test('OSM requests start only after surface focus and stay unique/bounded', async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    await installFixedDate(page);
    const mock = await installMockOsm(page);
    await openApp(page);
    await dismissHint(page);
    await page.waitForTimeout(900);
    expect(mock.requests).toHaveLength(0);

    const startedAt = Date.now();
    await focusManualLocation(page, CAIRO.latitudeDeg, CAIRO.longitudeDeg);
    await waitForMapReady(page);
    const readyMs = Date.now() - startedAt;

    const unique = new Set(mock.requests).size;
    test.info().annotations.push({
      type: 'cache-metrics',
      description: JSON.stringify({
        requests: mock.requests.length,
        unique,
        readyMs,
        cacheEntries: await countCacheEntries(page),
      }),
    });

    expect(mock.requests.length).toBeGreaterThan(0);
    expect(unique).toBe(mock.requests.length);
    expect(mock.requests.length).toBeLessThanOrEqual(16);
    expect(await countCacheEntries(page)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('persistent Cache Storage is reused after return and page reload', async ({ page }) => {
    const errors = trackPageErrors(page);
    await installFixedDate(page);
    const mock = await installMockOsm(page);
    await openApp(page);
    await dismissHint(page);

    await focusManualLocation(page, CAIRO.latitudeDeg, CAIRO.longitudeDeg);
    await waitForMapReady(page);
    const firstCount = mock.requests.length;
    expect(firstCount).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'نمای کلی' }).click();
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: /موقعیت شما/ }).click();
    await page.getByRole('button', { name: 'نمایش روی زمین' }).click();
    await waitForMapReady(page);
    expect(mock.requests).toHaveLength(firstCount);

    await page.reload();
    await openApp(page);
    await dismissHint(page);
    await focusManualLocation(page, CAIRO.latitudeDeg, CAIRO.longitudeDeg);
    await waitForMapReady(page);

    expect(mock.requests).toHaveLength(firstCount);
    expect(await countCacheEntries(page)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('Cache Storage survives a full browser restart with a persistent profile', async ({ browserName }, testInfo) => {
    void browserName;
    test.slow();
    const baseURL = testInfo.project.use.baseURL ?? 'http://127.0.0.1:4173';
    const profile = mkdtempSync(join(tmpdir(), 'cosmos-m006-profile-'));

    async function run(): Promise<{ requests: string[]; cacheEntries: number }> {
      const context = await chromium.launchPersistentContext(profile, {
        channel: 'chrome',
        headless: true,
        args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        locale: 'fa-IR',
      });
      try {
        const page = context.pages()[0] ?? (await context.newPage());
        const mock = await installMockOsm(page);
        await openApp(page, baseURL);
        await dismissHint(page);
        await focusManualLocation(page, CAIRO.latitudeDeg, CAIRO.longitudeDeg);
        await waitForMapReady(page);
        return {
          requests: [...mock.requests],
          cacheEntries: await countCacheEntries(page),
        };
      } finally {
        await context.close();
      }
    }

    try {
      const first = await run();
      expect(first.requests.length).toBeGreaterThan(0);
      expect(first.cacheEntries).toBeGreaterThan(0);

      const second = await run();
      expect(second.requests).toHaveLength(0);
      expect(second.cacheEntries).toBeGreaterThanOrEqual(first.cacheEntries);
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  });

  test('HTTP 404 marks the map layer as failed without a page crash', async ({ page }) => {
    const errors = trackPageErrors(page);
    await installFixedDate(page);
    await installMockOsm(page, { failWith: 404 });
    await openApp(page);
    await dismissHint(page);
    await focusManualLocation(page, CAIRO.latitudeDeg, CAIRO.longitudeDeg);
    await waitForMapError(page);
    expect(errors).toEqual([]);
  });

  test('HTTP 429 marks the map layer as failed without a page crash', async ({ page }) => {
    const errors = trackPageErrors(page);
    await installFixedDate(page);
    await installMockOsm(page, { failWith: 429 });
    await openApp(page);
    await dismissHint(page);
    await focusManualLocation(page, CAIRO.latitudeDeg, CAIRO.longitudeDeg);
    await waitForMapError(page);
    expect(errors).toEqual([]);
  });

  test('leaving the surface cancels pending OSM requests cleanly', async ({ page }) => {
    const errors = trackPageErrors(page);
    await installFixedDate(page);
    const mock = await installMockOsm(page, { hold: true, releaseWith: 'abort' });
    await openApp(page);
    await dismissHint(page);

    await focusManualLocation(page, CAIRO.latitudeDeg, CAIRO.longitudeDeg);
    await expect(page.locator('.map-loading-chip')).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => mock.requests.length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: 'نمای کلی' }).click();
    await page.waitForTimeout(2600);
    mock.release();
    await page.waitForTimeout(800);

    await expect(page.locator('.earth-imagery-status')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('persisted Cache Storage is trimmed to its configured cap', async ({ page }) => {
    const errors = trackPageErrors(page);
    await installFixedDate(page);
    await installMockOsm(page);
    await openApp(page);
    await page.evaluate(
      async ({ cacheName, count }) => {
        const cache = await caches.open(cacheName);
        for (let index = 0; index < count; index += 1) {
          await cache.put(
            new Request(`https://tile.openstreetmap.org/diagnostic-seed/${index}`),
            new Response('seed', {
              headers: {
                'content-type': 'text/plain',
                'x-cached-at': String(Date.now()),
              },
            }),
          );
        }
      },
      { cacheName: OSM_CACHE_NAME, count: 130 },
    );

    await focusManualLocation(page, CAIRO.latitudeDeg, CAIRO.longitudeDeg);
    await waitForMapReady(page);
    await expect
      .poll(() => countCacheEntries(page), { timeout: 15_000 })
      .toBeLessThanOrEqual(120);
    expect(errors).toEqual([]);
  });

  test('startup has no OSM traffic while the overview is displayed', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await page.waitForTimeout(1200);
    await expect(page.locator('.earth-map-status')).toHaveCount(0);
  });
});
