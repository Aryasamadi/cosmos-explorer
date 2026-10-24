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
  test('initial view opens without a forced Earth selection', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    await expect(page.locator('.scene-loading')).toBeHidden();

    await expect(pressedBody(page)).toHaveCount(0, { timeout: 3_000 });
  });

  test('Earth -> Moon -> Earth restores the previous Earth close view', async ({ page }) => {
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

    await expect(pressedBody(page)).toHaveText('زمین', { timeout: 3_000 });
    await expect(mapBefore).toContainText('جزئیات نقشه فعال', { timeout: 3_000 });
  });

  test('Free -> Sky -> Free preserves the selected Earth context', async ({ page }) => {
    await installFixedDate(page);
    await installMockOsm(page);
    await openApp(page);
    await dismissHint(page);

    await focusManualLocation(page, 30.0444, 31.2357);
    await waitForMapReady(page);
    await page.locator('.body-pill', { hasText: 'زمین' }).click();

    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    // Phase 1 shares the selected location with Sky, so the sky HUD opens
    // directly instead of the observer setup screen.
    await expect(page.getByTestId('sky-hud')).toBeVisible();
    await page.getByRole('button', { name: 'کاوش آزاد' }).click();
    await page.waitForTimeout(3200);

    await expect(pressedBody(page)).toHaveText('زمین', { timeout: 3_000 });
    await expect(
      page.locator('.earth-map-status').filter({ hasText: 'جزئیات نقشه فعال' }),
    ).toBeVisible({ timeout: 3_000 });
  });

  test('camera pose survives a mode round trip', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    await focusManualLocation(page, 30.0444, 31.2357);
    await page.waitForTimeout(3200);
    const before = await captureCanvasSignature(page);

    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    // Phase 1 shares the selected location with Sky, so the sky HUD opens
    // directly instead of the observer setup screen.
    await expect(page.getByTestId('sky-hud')).toBeVisible();
    await page.getByRole('button', { name: 'کاوش آزاد' }).click();
    await page.waitForTimeout(3200);
    const after = await captureCanvasSignature(page);

    expect(meanAbsoluteDifference(before, after)).toBeLessThan(5);
  });

  test('mouse and keyboard navigation move the camera and Home restores it', async ({ page }) => {
    test.setTimeout(360_000);
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    const initial = await captureCanvasSignature(page);

    await page.mouse.move(195, 430);
    await page.mouse.down();
    await page.mouse.move(265, 465, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const dragged = await captureCanvasSignature(page);
    expect(meanAbsoluteDifference(initial, dragged)).toBeGreaterThan(0.3);

    await page.mouse.move(195, 430);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(245, 460, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(400);
    const panned = await captureCanvasSignature(page);
    expect(meanAbsoluteDifference(dragged, panned)).toBeGreaterThan(0.2);

    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(300);
    const keyPanned = await captureCanvasSignature(page);
    expect(meanAbsoluteDifference(panned, keyPanned)).toBeGreaterThan(0.1);

    await page.mouse.wheel(0, -360);
    await page.waitForTimeout(400);
    const zoomed = await captureCanvasSignature(page);
    expect(meanAbsoluteDifference(keyPanned, zoomed)).toBeGreaterThan(0.2);

    await page.keyboard.press('Home');
    await page.waitForTimeout(1500);
    const home = await captureCanvasSignature(page);
    expect(meanAbsoluteDifference(initial, home)).toBeLessThan(5);

    await page.keyboard.press('Digit2');
    await page.waitForTimeout(1500);
    await expect(pressedBody(page)).toHaveText('ماه');
  });

  test('touch drag and pinch reach the free-space controls', async ({ page }) => {
    test.setTimeout(300_000);
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    const client = await page.context().newCDPSession(page);
    const initial = await captureCanvasSignature(page);

    const point = (x: number, y: number, id: number) => ({
      x,
      y,
      id,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    });

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(195, 430, 1)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(260, 470, 1)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(500);
    const dragged = await captureCanvasSignature(page);
    expect(meanAbsoluteDifference(initial, dragged)).toBeGreaterThan(0.2);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(145, 420, 2), point(245, 420, 3)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(105, 420, 2), point(285, 420, 3)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(500);
    const pinched = await captureCanvasSignature(page);
    expect(meanAbsoluteDifference(dragged, pinched)).toBeGreaterThan(0.2);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(145, 420, 4), point(245, 420, 5)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(185, 450, 4), point(285, 450, 5)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(500);
    const touchPanned = await captureCanvasSignature(page);
    expect(meanAbsoluteDifference(pinched, touchPanned)).toBeGreaterThan(0.1);
    await client.detach();
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
