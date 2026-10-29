import { expect, test } from '@playwright/test';
import {
  blockOsm,
  dismissHint,
  focusManualLocation,
  installFixedDate,
  installMockOsm,
  openApp,
  waitForEarthImageryReady,
  waitForMapError,
} from './helpers';

async function prepare(
  page: Parameters<typeof openApp>[0],
  fixedUtc?: string,
): Promise<void> {
  await installFixedDate(page, fixedUtc);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await blockOsm(page);
  await openApp(page);
  await dismissHint(page);
  await page.waitForTimeout(900);
}

test.describe('initial view 320 mobile', () => {
  test.use({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });

  test('initial-320', async ({ page }) => {
    await prepare(page);
    await expect(page).toHaveScreenshot('initial-320.png');
  });
});

test.describe('initial view 390 mobile', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });

  test('initial-390', async ({ page }) => {
    await prepare(page);
    await expect(page).toHaveScreenshot('initial-390.png');
  });

  test('earth-day-390', async ({ page }) => {
    await prepare(page);
    await focusManualLocation(page, 30.0444, 31.2357);
    await waitForEarthImageryReady(page);
    await page.waitForTimeout(1800);
    await expect(page).toHaveScreenshot('earth-day-390.png');
  });

  test('earth-night-390', async ({ page }) => {
    await prepare(page);
    await focusManualLocation(page, 21.3069, -157.8583);
    await waitForEarthImageryReady(page);
    await page.waitForTimeout(1800);
    await expect(page).toHaveScreenshot('earth-night-390.png');
  });

  test('moon-390', async ({ page }) => {
    await prepare(page);
    await page.locator('.body-pill', { hasText: 'ماه' }).click();
    await expect(page.getByTestId('celestial-info-panel')).toBeVisible();
    await page.getByTestId('celestial-info-panel').getByRole('button', { name: 'بستن اطلاعات' }).click();
    await page.waitForTimeout(1800);
    await expect(page).toHaveScreenshot('moon-390.png');
  });

  test('moon-gibbous-390', async ({ page }) => {
    await prepare(page, '2026-09-23T00:00:00.000Z');
    await page.locator('.body-pill', { hasText: 'ماه' }).click();
    await expect(page.getByTestId('celestial-info-panel')).toBeVisible();
    await page.getByTestId('celestial-info-panel').getByRole('button', { name: 'بستن اطلاعات' }).click();
    await page.waitForTimeout(1800);
    await expect(page).toHaveScreenshot('moon-gibbous-390.png');
  });

  test('mars-390', async ({ page }) => {
    await prepare(page);
    await page.locator('.body-pill', { hasText: 'مریخ' }).click();
    await expect(page.getByTestId('celestial-info-panel')).toBeVisible();
    await page.getByTestId('celestial-info-panel').getByRole('button', { name: 'بستن اطلاعات' }).click();
    await page.waitForTimeout(1800);
    await expect(page).toHaveScreenshot('mars-390.png');
  });

  test('location-sheet-390', async ({ page }) => {
    await prepare(page);
    await page.getByRole('button', { name: 'موقعیت من روی زمین' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('location-sheet-390.png');
  });

  test('tile-loading-and-error-390', async ({ page }) => {
    await installFixedDate(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const mock = await installMockOsm(page, { hold: true, releaseWith: 'abort' });
    await openApp(page);
    await dismissHint(page);
    await focusManualLocation(page, 30.0444, 31.2357);
    await expect(page.locator('.map-loading-chip')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('tile-loading-390.png');

    mock.release();
    await waitForMapError(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('tile-error-390.png');
  });
});

test.describe('initial view 768 tablet', () => {
  test.use({
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });

  test('initial-768', async ({ page }) => {
    await prepare(page);
    await expect(page).toHaveScreenshot('initial-768.png');
  });
});

test.describe('initial view 1280 desktop', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  test('initial-1280', async ({ page }) => {
    await prepare(page);
    await expect(page).toHaveScreenshot('initial-1280.png');
  });
});
