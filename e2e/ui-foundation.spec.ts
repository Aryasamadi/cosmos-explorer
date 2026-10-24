import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

async function openFreeMode(page: Page): Promise<void> {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'کاوش آزاد' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('.scene-loading')).toBeHidden({ timeout: 90_000 });
}

test.describe('M1 UI foundation', () => {
  test('keeps all layouts overflow-free with readable, reachable controls', async ({ page }) => {
    await openFreeMode(page);
    await page.evaluate(() =>
      (document.querySelector('.hint-bubble__close') as HTMLElement | null)?.click(),
    );

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);

      const metrics = await page.evaluate(() => {
        const rect = (element: Element | null) => {
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return {
            left: box.left,
            top: box.top,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          };
        };
        const visible = (element: Element) => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            box.width > 0 &&
            box.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
          );
        };
        const selectors = [
          '.mode-switch__button',
          '.app-header__settings',
          '.free-top-actions .button',
          '.earth-location-pill',
          '.body-pill',
          '.hint-bubble__close',
        ];
        const controls = selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector))
            .filter(visible)
            .map((element) => ({
              selector,
              width: element.getBoundingClientRect().width,
              height: element.getBoundingClientRect().height,
            })),
        );
        const textSelectors = [
          '.brand__title',
          '.mode-switch__button',
          '.free-top-actions .button',
          '.earth-location-pill',
          '.body-pill',
        ];
        const textSizes = textSelectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector))
            .filter(visible)
            .map((element) => ({
              selector,
              size: Number.parseFloat(getComputedStyle(element).fontSize),
            })),
        );
        const topActions = rect(document.querySelector('.free-top-actions'));
        const scale = rect(document.querySelector('.scale-badge'));
        const header = rect(document.querySelector('.app-header'));
        const bottom = rect(document.querySelector('.free-bottom'));
        const overlaps = (a: typeof header, b: typeof header) =>
          Boolean(
            a &&
              b &&
              a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top,
          );
        return {
          viewport: { width: innerWidth, height: innerHeight },
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          controls,
          textSizes,
          topActionsBelowHeader: Boolean(header && topActions && topActions.top >= header.bottom),
          scaleBelowHeader: Boolean(header && scale && scale.top >= header.bottom),
          topControlsOverlap: overlaps(topActions, scale),
          bottomInsideViewport: Boolean(bottom && bottom.bottom <= innerHeight + 1),
          headings: document.querySelectorAll('h1').length,
          main: Boolean(document.querySelector('main#main-content')),
          skipLink: Boolean(document.querySelector('.skip-link')),
        };
      });

      expect(metrics.overflow, `overflow at ${viewport.width}x${viewport.height}`).toBe(false);
      expect(metrics.topActionsBelowHeader).toBe(true);
      expect(metrics.scaleBelowHeader).toBe(true);
      expect(metrics.topControlsOverlap).toBe(false);
      expect(metrics.bottomInsideViewport).toBe(true);
      expect(metrics.headings).toBe(1);
      expect(metrics.main).toBe(true);
      expect(metrics.skipLink).toBe(true);

      for (const control of metrics.controls) {
        expect(
          control.width,
          `${control.selector} width at ${viewport.width}x${viewport.height}`,
        ).toBeGreaterThanOrEqual(43.5);
        expect(
          control.height,
          `${control.selector} height at ${viewport.width}x${viewport.height}`,
        ).toBeGreaterThanOrEqual(43.5);
      }
      for (const text of metrics.textSizes) {
        expect(
          text.size,
          `${text.selector} font size at ${viewport.width}x${viewport.height}`,
        ).toBeGreaterThanOrEqual(12);
      }
    }
  });

  test('keeps primary sheet and setup actions at touch size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFreeMode(page);

    await page.getByRole('button', { name: /موقعیت من روی زمین/ }).click();
    const locationDialog = page.getByRole('dialog', { name: 'موقعیت من' });
    const locationButtons = locationDialog.getByRole('button');
    for (let index = 0; index < (await locationButtons.count()); index += 1) {
      const box = await locationButtons.nth(index).boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    }
    await locationDialog.getByRole('button', { name: 'بستن', exact: true }).click();

    await page.getByRole('button', { name: 'تنظیمات و منابع' }).click();
    const settingsDialog = page.getByRole('dialog', { name: 'تنظیمات و منابع' });
    const settingsButtons = settingsDialog.getByRole('button');
    for (let index = 0; index < (await settingsButtons.count()); index += 1) {
      const box = await settingsButtons.nth(index).boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    }
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    const setup = page.locator('.setup-card');
    const setupButtons = setup.getByRole('button');
    for (let index = 0; index < (await setupButtons.count()); index += 1) {
      const box = await setupButtons.nth(index).boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('traps keyboard focus, inerts the background and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFreeMode(page);
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();

    const settingsButton = page.getByRole('button', { name: 'تنظیمات و منابع' });
    await settingsButton.click();
    const dialog = page.getByRole('dialog', { name: 'تنظیمات و منابع' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('.app-header')).toHaveAttribute('inert', '');
    await expect(page.locator('.app-main')).toHaveAttribute('inert', '');

    const activeInside = () =>
      page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    expect(await activeInside()).toBe(true);

    await page.keyboard.press('Shift+Tab');
    expect(await activeInside()).toBe(true);

    for (let index = 0; index < 24; index += 1) {
      await page.keyboard.press('Tab');
      expect(await activeInside()).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('.app-header')).not.toHaveAttribute('inert', '');
    await expect(page.locator('.app-main')).not.toHaveAttribute('inert', '');
    await expect(settingsButton).toBeFocused();
  });
});
