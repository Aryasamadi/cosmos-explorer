import { expect, type Page } from '@playwright/test';

export const FIXED_UTC = '2026-06-21T12:00:00.000Z';
export const FIXED_MS = Date.parse(FIXED_UTC);
export const OSM_CACHE_NAME = 'cosmos-explorer-osm-tiles-v1';

const SYNTHETIC_TILE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGMMqIhiYGBgYgADAA24ASYGXMCAAAAAAElFTkSuQmCC';
export const SYNTHETIC_TILE_PNG = Buffer.from(SYNTHETIC_TILE_BASE64, 'base64');

const FIXED_DATE_SCRIPT = `
  (() => {
    const fixed = ${FIXED_MS};
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() { return fixed; }
    }
    Object.defineProperty(globalThis, 'Date', {
      value: FixedDate,
      writable: true,
      configurable: true,
    });
  })();
`;

export async function installFixedDate(page: Page): Promise<void> {
  await page.addInitScript({ content: FIXED_DATE_SCRIPT });
}

export async function blockOsm(page: Page): Promise<void> {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort('failed'));
}

export interface MockOsmOptions {
  /** Keep requests pending until release() is called. */
  hold?: boolean;
  /** Action taken after a held request is released. */
  releaseWith?: 'success' | 'abort';
  /** Return this HTTP status instead of a synthetic tile. */
  failWith?: number;
}

export interface MockOsm {
  requests: string[];
  release: () => void;
}

export async function installMockOsm(
  page: Page,
  options: MockOsmOptions = {},
): Promise<MockOsm> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: string[] = [];

  await page.route('https://tile.openstreetmap.org/**', async (route) => {
    requests.push(route.request().url());
    if (options.hold) await gate;
    if (options.releaseWith === 'abort') {
      await route.abort('failed');
      return;
    }
    if (options.failWith) {
      await route.fulfill({
        status: options.failWith,
        contentType: 'text/plain',
        headers: { 'access-control-allow-origin': '*' },
        body: '',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=86400',
      },
      body: SYNTHETIC_TILE_PNG,
    });
  });

  return { requests, release };
}

export async function openApp(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'کاوش آزاد' })).toBeVisible();
  await expect(page.locator('.scene-loading')).toBeHidden({ timeout: 60_000 });
}

export async function dismissHint(page: Page): Promise<void> {
  await page.evaluate(() => {
    const close = document.querySelector<HTMLButtonElement>('.hint-bubble__close');
    close?.click();
  });
  await page.locator('.hint-bubble').waitFor({ state: 'detached', timeout: 2_000 }).catch(
    () => undefined,
  );
}

export async function focusManualLocation(
  page: Page,
  latitude: number,
  longitude: number,
): Promise<void> {
  await page.getByRole('button', { name: 'موقعیت من روی زمین' }).click();
  await page.getByRole('button', { name: 'ورود مختصات دستی' }).click();
  await page.getByPlaceholder('مثلاً 35.6892').fill(latitude.toFixed(5));
  await page.getByPlaceholder('مثلاً 51.3890').fill(longitude.toFixed(5));
  await page.getByRole('button', { name: 'ثبت این مختصات روی زمین' }).click();
}

export async function waitForMapReady(page: Page): Promise<void> {
  await expect(
    page.locator('.earth-map-status').filter({ hasText: 'جزئیات نقشه فعال' }),
  ).toBeVisible({ timeout: 60_000 });
}

export async function waitForMapError(page: Page): Promise<void> {
  await expect(page.locator('.earth-map-status--error')).toBeVisible({
    timeout: 60_000,
  });
}

export async function waitForEarthImageryReady(page: Page): Promise<void> {
  await expect(page.locator('.earth-imagery-status')).toContainText('NASA Blue Marble', {
    timeout: 60_000,
  });
}

export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export async function countCacheEntries(page: Page): Promise<number> {
  return page.evaluate(async (cacheName) => {
    if (typeof caches === 'undefined') return 0;
    const cache = await caches.open(cacheName);
    return (await cache.keys()).length;
  }, OSM_CACHE_NAME);
}

export async function captureCanvasSignature(page: Page): Promise<number[]> {
  const screenshot = await page.locator('canvas').screenshot({ animations: 'disabled' });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    context.drawImage(image, 0, 0, 24, 24);
    const pixels = context.getImageData(0, 0, 24, 24).data;
    const values: number[] = [];
    for (let index = 0; index < pixels.length; index += 4) {
      values.push(
        0.2126 * pixels[index]! +
          0.7152 * pixels[index + 1]! +
          0.0722 * pixels[index + 2]!,
      );
    }
    return values;
  }, screenshot.toString('base64'));
}

export function meanAbsoluteDifference(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return Infinity;
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += Math.abs((left[index] ?? 0) - (right[index] ?? 0));
  }
  return sum / left.length;
}

export async function readWebGlRenderer(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!context) return 'webgl-unavailable';
    const extension = context.getExtension('WEBGL_debug_renderer_info');
    return extension
      ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL))
      : 'renderer-info-unavailable';
  });
}
