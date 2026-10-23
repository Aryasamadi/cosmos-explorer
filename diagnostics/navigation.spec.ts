import { expect, test, type Page } from '@playwright/test';
import {
  blockOsm,
  captureCanvasSignature,
  dismissHint,
  focusManualLocation,
  installFixedDate,
  installMockOsm,
  meanAbsoluteDifference,
  openApp,
  trackPageErrors,
  waitForMapReady,
} from './helpers';

function pressedBody(page: Page) {
  return page.locator('.body-pill[aria-pressed="true"]');
}

test.describe('navigation and state preservation diagnostics', () => {
  test('KNOWN DEFECT: initial view should be free-space with no forced Earth selection', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'known-defect',
      description: 'initialAppState in src/app/appState.ts selects Earth by default',
    });
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    await expect(page.locator('.scene-loading')).toBeHidden();

    test.fail();
    await expect(pressedBody(page)).toHaveCount(0, { timeout: 3_000 });
  });

  test('KNOWN DEFECT: Earth -> Moon -> Earth should restore the previous Earth close view', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'known-defect',
      description:
        'App.tsx unmounts FreeExploreMode; focusBody(earth) resets to overview instead of restoring the prior close view',
    });
    await installFixedDate(page);
    await installMockOsm(page);
    await openApp(page);
    await dismissHint(page);

    await focusManualLocation(page, 30.0444, 31.2357);
    await waitForMapReady(page);
    const mapBefore = page.locator('.earth-map-status');

    await page.locator('.body-pill', { hasText: 'ماه' }).click();
    await expect(page.getByTestId('celestial-info-panel')).toBeVisible();
    await page.getByTestId('celestial-info-panel').getByRole('button', { name: 'بستن اطلاعات' }).click();
    await page.waitForTimeout(2200);

    await page.locator('.body-pill', { hasText: 'زمین' }).click();
    await page.waitForTimeout(2600);

    test.fail();
    await expect(pressedBody(page)).toHaveText('زمین', { timeout: 3_000 });
    await expect(mapBefore).toContainText('جزئیات نقشه فعال', { timeout: 3_000 });
  });

  test('KNOWN DEFECT: Free -> Sky -> Free should preserve selected Earth context', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'known-defect',
      description:
        'Mode switch unmounts the scene; returning to free mode keeps selectedBodyId=sun and starts a new scene',
    });
    await installFixedDate(page);
    await installMockOsm(page);
    await openApp(page);
    await dismissHint(page);

    await focusManualLocation(page, 30.0444, 31.2357);
    await waitForMapReady(page);

    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    await expect(
      page.getByRole('heading', { name: 'آسمان از کجا دیده می‌شود؟' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'کاوش آزاد' }).click();
    await page.waitForTimeout(3200);

    test.fail();
    await expect(pressedBody(page)).toHaveText('زمین', { timeout: 3_000 });
    await expect(
      page.locator('.earth-map-status').filter({ hasText: 'جزئیات نقشه فعال' }),
    ).toBeVisible({ timeout: 3_000 });
  });

  test('KNOWN DEFECT: camera pose should survive a mode round trip', async ({ page }) => {
    test.info().annotations.push({
      type: 'known-defect',
      description:
        'The renderer and camera are recreated on mode switch; no camera pose is persisted or restored',
    });
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    await focusManualLocation(page, 30.0444, 31.2357);
    await page.waitForTimeout(3200);
    const before = await captureCanvasSignature(page);

    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    await expect(
      page.getByRole('heading', { name: 'آسمان از کجا دیده می‌شود؟' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'کاوش آزاد' }).click();
    await page.waitForTimeout(3200);
    const after = await captureCanvasSignature(page);

    test.fail();
    expect(meanAbsoluteDifference(before, after)).toBeLessThan(5);
  });

  test('manual return to the saved location still reloads map detail from cache', async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    await installFixedDate(page);
    const mock = await installMockOsm(page);
    await openApp(page);
    await dismissHint(page);

    await focusManualLocation(page, 30.0444, 31.2357);
    await waitForMapReady(page);
    const countAfterFirstLoad = mock.requests.length;

    await page.getByRole('button', { name: 'نمای کلی' }).click();
    await page.waitForTimeout(2200);
    await expect(page.locator('.earth-map-status')).toHaveCount(0);

    await page.getByRole('button', { name: /موقعیت شما/ }).click();
    await page.getByRole('button', { name: 'نمایش روی زمین' }).click();
    await waitForMapReady(page);

    expect(countAfterFirstLoad).toBeGreaterThan(0);
    expect(new Set(mock.requests).size).toBe(mock.requests.length);
    expect(mock.requests.length).toBe(countAfterFirstLoad);
    expect(errors).toEqual([]);
  });
});
