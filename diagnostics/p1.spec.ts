import { expect, test } from '@playwright/test';
import {
  dismissHint,
  focusManualLocation,
  installFixedDate,
  installMockOsm,
  openApp,
  waitForMapReady,
} from './helpers';

test('P1 correctness controls: labels, scale help, and map layer state', async ({
  page,
}) => {
  await installFixedDate(page, '2026-01-15T09:00:00Z');
  await installMockOsm(page);
  await openApp(page);
  await dismissHint(page);

  await expect(page.locator('.free-body-label:visible').first()).toBeVisible();
  await expect(page.locator('.map-attribution-corner')).toHaveCount(0);

  const scale = page.locator('.scale-badge');
  await expect(scale).toHaveAttribute('aria-expanded', 'false');
  await scale.tap();
  await expect(page.locator('#free-scale-help')).toBeVisible();
  await expect(scale).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#free-scale-help')).toHaveCount(0);
  await scale.focus();
  await scale.press('Enter');
  await expect(page.locator('#free-scale-help')).toBeVisible();
  await page.keyboard.press('Escape');

  await focusManualLocation(page, 35.6892, 51.389);
  await waitForMapReady(page);
  await expect(page.locator('.map-attribution-corner')).toBeVisible();

  await page.locator('.earth-location-pill').click();
  const sheet = page.getByRole('dialog', { name: 'موقعیت من' });
  await sheet.waitFor();
  await sheet.locator('.switch-row').filter({ hasText: 'نقشهٔ خیابانی' }).click();
  await page.getByRole('dialog', { name: 'موقعیت من' }).getByRole('button', { name: 'بستن', exact: true }).click();
  await expect(page.locator('.map-attribution-corner')).toHaveCount(0);

  await page.locator('.earth-location-pill').click();
  await sheet.waitFor();
  await sheet.locator('.switch-row').filter({ hasText: 'نقشهٔ خیابانی' }).click();
  await waitForMapReady(page);
  await expect(page.locator('.map-attribution-corner')).toBeVisible();
});
