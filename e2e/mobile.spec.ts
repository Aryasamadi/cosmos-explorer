import { expect, test, type Page } from '@playwright/test';
import {
  computeSubsolarPoint,
  solarDotAt,
} from '../src/astronomy/ephemeris/subsolarPoint';

const DAYLIGHT_LAND_CANDIDATES = [
  { name: 'Riyadh', latitudeDeg: 24.71, longitudeDeg: 46.68 },
  { name: 'Cairo', latitudeDeg: 30.04, longitudeDeg: 31.24 },
  { name: 'Tehran', latitudeDeg: 35.69, longitudeDeg: 51.39 },
  { name: 'Madrid', latitudeDeg: 40.42, longitudeDeg: -3.7 },
  { name: 'Denver', latitudeDeg: 39.74, longitudeDeg: -104.99 },
  { name: 'Mexico City', latitudeDeg: 19.43, longitudeDeg: -99.13 },
  { name: 'Delhi', latitudeDeg: 28.61, longitudeDeg: 77.21 },
  { name: 'Beijing', latitudeDeg: 39.9, longitudeDeg: 116.4 },
  { name: 'Johannesburg', latitudeDeg: -26.2, longitudeDeg: 28.05 },
  { name: 'Nairobi', latitudeDeg: -1.29, longitudeDeg: 36.82 },
  { name: 'Sao Paulo', latitudeDeg: -23.55, longitudeDeg: -46.63 },
  { name: 'Perth', latitudeDeg: -31.95, longitudeDeg: 115.86 },
  { name: 'Alice Springs', latitudeDeg: -23.7, longitudeDeg: 133.88 },
  { name: 'Los Angeles', latitudeDeg: 34.05, longitudeDeg: -118.24 },
];

function pickDaylightLand(): { latitudeDeg: number; longitudeDeg: number; dot: number } {
  const subsolar = computeSubsolarPoint(new Date());
  return DAYLIGHT_LAND_CANDIDATES.map((candidate) => ({
    ...candidate,
    dot: solarDotAt(candidate, subsolar),
  })).sort((a, b) => b.dot - a.dot)[0]!;
}

interface PatchStats {
  meanLuma: number;
  darkRatio: number;
}

/**
 * Samples a patch below the map loading chip and above the bottom HUD, where
 * the focused Earth fills the viewport. A fragmented or transparent globe
 * shows the near-black scene background here.
 */
async function sampleEarthPatch(page: Page): Promise<PatchStats> {
  const screenshot = await page.screenshot({ animations: 'disabled' });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    context.drawImage(image, 0, 0);
    const width = Math.round(image.naturalWidth * 0.16);
    const height = Math.round(image.naturalHeight * 0.035);
    const x = Math.round((image.naturalWidth - width) / 2);
    const y = Math.round(image.naturalHeight * 0.55 - height / 2);
    const pixels = context.getImageData(x, y, width, height).data;
    let sum = 0;
    let dark = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luma =
        0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      sum += luma;
      if (luma < 8) dark += 1;
      count += 1;
    }
    return { meanLuma: sum / count, darkRatio: dark / count };
  }, screenshot.toString('base64'));
}

function expectSolidDaylitEarth(stats: PatchStats, phase: string): void {
  expect(stats.meanLuma, `${phase}: Earth patch is too dark`).toBeGreaterThan(12);
  expect(stats.darkRatio, `${phase}: Earth patch contains background holes`).toBeLessThan(0.3);
}

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
  permissions: ['geolocation'],
  geolocation: { latitude: 35.6892, longitude: 51.389, accuracy: 30 },
});

test('missing map tiles do not crash the Earth view', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // OSM's tile policy forbids headless bots from forcing tile renders, and CI
  // must not depend on a third-party service. This test deliberately fails
  // every tile request and verifies the global fallback stays usable.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort('failed'),
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'کاوش آزاد' })).toBeVisible();
  await page.waitForTimeout(1500);

  const webglFallback = page.getByText('نمایش صحنهٔ سه‌بعدی ممکن نشد');
  if (await webglFallback.isVisible().catch(() => false)) {
    test.skip(true, 'WebGL is unavailable in this browser run; tile failure cannot be exercised.');
  }

  await page.getByRole('button', { name: 'موقعیت من روی زمین' }).click();
  await page.getByRole('button', { name: 'ورود مختصات دستی' }).click();
  await page.getByPlaceholder('مثلاً 35.6892').fill('35.6892');
  await page.getByPlaceholder('مثلاً 51.3890').fill('51.389');
  await page.getByRole('button', { name: 'ثبت این مختصات روی زمین' }).click();

  await expect(page.getByRole('button', { name: /موقعیت شما/ })).toBeVisible();
  await expect(page.locator('.earth-map-status--error')).toBeVisible({
    timeout: 40_000,
  });
  await expect(page.locator('.map-attribution-corner')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('daylit land stays solid while tiles load, fail, and under near-surface zoom', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  // Hold every tile request so the test can sample the base Earth in the
  // loading state, then fail them all and sample the error state. No OSM
  // traffic is generated by this test.
  let releaseTiles!: () => void;
  const tileGate = new Promise<void>((resolve) => {
    releaseTiles = resolve;
  });
  await page.route('https://tile.openstreetmap.org/**', async (route) => {
    await tileGate;
    await route.abort('failed');
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'کاوش آزاد' })).toBeVisible();
  await expect(page.locator('.scene-loading')).toBeHidden({ timeout: 30_000 }).catch(() => {
    test.skip(true, 'WebGL did not become ready in this browser run.');
  });
  const webglFallback = page.getByText('نمایش صحنهٔ سه‌بعدی ممکن نشد');
  if (await webglFallback.isVisible().catch(() => false)) {
    test.skip(true, 'WebGL is unavailable in this browser run.');
  }

  // Mid-Pacific deep ocean is nearly black in the day texture, so focus a
  // sunlit landmass to distinguish a solid base from holes showing the scene
  // background.
  const daylightLand = pickDaylightLand();
  expect(daylightLand.dot).toBeGreaterThan(0.4);
  await page.getByRole('button', { name: 'موقعیت من روی زمین' }).click();
  await page.getByRole('button', { name: 'ورود مختصات دستی' }).click();
  await page
    .getByPlaceholder('مثلاً 35.6892')
    .fill(daylightLand.latitudeDeg.toFixed(5));
  await page
    .getByPlaceholder('مثلاً 51.3890')
    .fill(daylightLand.longitudeDeg.toFixed(5));
  await page.getByRole('button', { name: 'ثبت این مختصات روی زمین' }).click();

  await expect(page.locator('.map-loading-chip')).toBeVisible({ timeout: 30_000 });
  expectSolidDaylitEarth(await sampleEarthPatch(page), 'tiles loading');

  releaseTiles();
  await expect(page.locator('.earth-map-status--error')).toBeVisible({ timeout: 40_000 });
  expectSolidDaylitEarth(await sampleEarthPatch(page), 'tiles failed');

  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('WebGL canvas is missing.');
    for (let index = 0; index < 24; index += 1) {
      canvas.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -600, bubbles: true, cancelable: true }),
      );
    }
  });
  await page.waitForTimeout(2500);
  expectSolidDaylitEarth(await sampleEarthPatch(page), 'near-surface zoom');
  await expect(page.getByRole('button', { name: /موقعیت شما/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('device geolocation is shown with its reported accuracy', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort('failed'),
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'کاوش آزاد' })).toBeVisible();
  await page.getByRole('button', { name: 'موقعیت من روی زمین' }).click();
  await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();

  const locationButton = page.getByRole('button', { name: /موقعیت شما/ });
  await expect(locationButton).toBeVisible();
  await expect(locationButton).toContainText('شعاع دقت گزارش‌شده');
  await expect(locationButton).toContainText('۳۰');
  expect(pageErrors).toEqual([]);
});

test('mobile explorer flow: selection, info panel, manual sky location', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'کاوش آزاد' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'آسمان واقعی' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  for (const name of ['زمین', 'ماه', 'خورشید', 'مریخ']) {
    await expect(page.locator('.body-pill', { hasText: name })).toBeVisible();
  }

  await page.locator('.body-pill', { hasText: 'ماه' }).click();
  const freeInfo = page.getByTestId('celestial-info-panel');
  await expect(freeInfo).toBeVisible();
  await expect(freeInfo.getByRole('heading', { name: 'ماه' })).toBeVisible();
  await expect(freeInfo.getByText(/مقیاس واقعی نجومی/)).toBeVisible();
  await freeInfo.getByRole('button', { name: 'بستن اطلاعات' }).click();
  await expect(freeInfo).toBeHidden();

  await page.getByRole('button', { name: 'آسمان واقعی' }).click();
  await expect(
    page.getByRole('heading', { name: 'آسمان از کجا دیده می‌شود؟' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /ورود مختصات به‌صورت دستی/ }).click();
  await page.getByPlaceholder('مثلاً 35.6892').fill('35.6892');
  await page.getByPlaceholder('مثلاً 51.3890').fill('51.389');
  await page.getByRole('button', { name: 'استفاده از این مکان' }).click();

  await expect(page.getByTestId('sky-hud')).toBeVisible();
  await expect(page.getByRole('button', { name: 'حسگر خاموش' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'مکان/زمان' })).toBeVisible();

  await page.getByRole('button', { name: 'اجرام', exact: true }).click();
  const objectsDialog = page.getByRole('dialog');
  await expect(objectsDialog).toBeVisible();
  await objectsDialog.getByRole('button', { name: /مریخ/ }).click();

  const skyInfo = page.getByTestId('celestial-info-panel');
  await expect(skyInfo).toBeVisible();
  await expect(skyInfo.getByRole('heading', { name: 'مریخ' })).toBeVisible();
  await expect(skyInfo.getByRole('heading', { name: 'موقعیت در آسمان ناظر' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
