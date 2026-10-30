import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  dismissHint,
  focusManualLocation,
  installFixedDate,
  installMockOsm,
  openApp,
  waitForMapReady,
} from './helpers';

const TARGET_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

function pressedBody(page: Page) {
  return page.locator('.body-pill[aria-pressed="true"]');
}

function activeMapDetail(page: Page) {
  return page
    .locator('.earth-map-status')
    .filter({ hasText: 'جزئیات نقشه فعال' });
}

async function expectLayout(page: Page, label: string): Promise<void> {
  const metrics = await page.evaluate(() => {
    const visibleBox = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        box.width === 0 ||
        box.height === 0 ||
        style.display === 'none' ||
        style.visibility === 'hidden'
      ) {
        return null;
      }
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
      };
    };
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      activePanels: document.querySelectorAll('.mode-panel:not([hidden])').length,
      freeBottom: visibleBox('.free-bottom'),
      skyBottom: visibleBox('.sky-bottom'),
      skyHud: visibleBox('[data-testid="sky-hud"]'),
    };
  });

  expect(metrics.activePanels, `${label}: active mode panels`).toBe(1);
  expect(
    metrics.scrollWidth,
    `${label}: horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);

  const bottom = metrics.freeBottom ?? metrics.skyBottom;
  expect(bottom, `${label}: bottom controls`).not.toBeNull();
  expect(bottom!.left, `${label}: bottom controls left`).toBeGreaterThanOrEqual(-1);
  expect(bottom!.right, `${label}: bottom controls right`).toBeLessThanOrEqual(
    metrics.viewportWidth + 1,
  );
  expect(bottom!.bottom, `${label}: bottom controls bottom`).toBeLessThanOrEqual(
    metrics.viewportHeight + 1,
  );
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: 'disabled',
  });
}

test('M1+M2 integration stays intact across viewports and state cycles', async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000);
  await installFixedDate(page);
  await installMockOsm(page);

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('tile.openstreetmap.org')) return;
    failedRequests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`,
    );
  });

  await openApp(page);
  await dismissHint(page);
  await expect(pressedBody(page)).toHaveCount(0);

  for (const viewport of TARGET_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(350);
    const label = `free ${viewport.width}x${viewport.height}`;
    await expectLayout(page, label);
    await capture(page, testInfo, `free-${viewport.width}x${viewport.height}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await focusManualLocation(page, 30.0444, 31.2357);
  await waitForMapReady(page);

  await page.locator('.body-pill', { hasText: 'زمین' }).click();
  await page
    .getByTestId('celestial-info-panel')
    .getByRole('button', { name: 'فوکوس روی زمین' })
    .click();
  await page.waitForTimeout(2600);
  await expect(pressedBody(page)).toHaveText('زمین');
  await expect(activeMapDetail(page)).toBeVisible();
  await capture(page, testInfo, 'earth-close-390');

  await page
    .getByTestId('celestial-info-panel')
    .getByRole('button', { name: 'بستن اطلاعات' })
    .click();
  await page.locator('.body-pill', { hasText: 'ماه' }).click();
  await page
    .getByTestId('celestial-info-panel')
    .getByRole('button', { name: 'فوکوس روی ماه' })
    .click();
  await page.waitForTimeout(1800);
  await expect(pressedBody(page)).toHaveText('ماه');
  await page
    .getByTestId('celestial-info-panel')
    .getByRole('button', { name: 'بستن اطلاعات' })
    .click();

  await page.locator('.body-pill', { hasText: 'زمین' }).click();
  await page
    .getByTestId('celestial-info-panel')
    .getByRole('button', { name: 'فوکوس روی زمین' })
    .click();
  await page.waitForTimeout(2600);
  await expect(pressedBody(page)).toHaveText('زمین');
  await expect(activeMapDetail(page)).toBeVisible();
  await capture(page, testInfo, 'earth-restored-390');

  await page.getByRole('button', { name: 'آسمان واقعی' }).click();
  await expect(page.getByTestId('sky-hud')).toBeVisible({ timeout: 30_000 });

  for (const viewport of TARGET_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(350);
    const label = `sky ${viewport.width}x${viewport.height}`;
    await expectLayout(page, label);
    await expect(page.getByTestId('sky-hud')).toBeVisible();
    await capture(page, testInfo, `sky-${viewport.width}x${viewport.height}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'کاوش آزاد' }).click();
  await expect(pressedBody(page)).toHaveText('زمین');
  await expect(activeMapDetail(page)).toBeVisible();
  await page.waitForTimeout(2200);
  await capture(page, testInfo, 'free-restored-390');

  await page.keyboard.press('Home');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(1500);
  await expect(pressedBody(page)).toHaveText('ماه');

  expect(pageErrors, 'page errors').toEqual([]);
  expect(consoleErrors, 'console errors').toEqual([]);
  expect(failedRequests, 'failed network requests').toEqual([]);
});
