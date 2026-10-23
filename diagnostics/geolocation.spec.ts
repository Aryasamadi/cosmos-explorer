import { expect, test, type Page } from '@playwright/test';
import {
  blockOsm,
  dismissHint,
  installFixedDate,
  openApp,
  trackPageErrors,
} from './helpers';

type GeoMode = 'denied' | 'timeout' | 'unavailable' | 'coarse-success' | 'unsupported';

async function installGeoMock(page: Page, mode: GeoMode): Promise<void> {
  await page.addInitScript((requestedMode: GeoMode) => {
    const counts = { high: 0, coarse: 0 };
    Object.defineProperty(window, '__geoCounts', {
      value: counts,
      configurable: true,
    });

    if (requestedMode === 'unsupported') {
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        configurable: true,
      });
      return;
    }

    const position = {
      coords: {
        latitude: 30.0444,
        longitude: 31.2357,
        accuracy: 900,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } as GeolocationPosition;

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          success: PositionCallback,
          error?: PositionErrorCallback | null,
          options?: PositionOptions,
        ) => {
          const high = options?.enableHighAccuracy === true;
          if (high) counts.high += 1;
          else counts.coarse += 1;
          setTimeout(() => {
            if (requestedMode === 'coarse-success' && !high) {
              success(position);
              return;
            }
            const code =
              requestedMode === 'denied'
                ? 1
                : requestedMode === 'unavailable'
                  ? 2
                  : 3;
            error?.({ code, message: requestedMode } as GeolocationPositionError);
          }, 0);
        },
        watchPosition: (
          _success: PositionCallback,
          error?: PositionErrorCallback | null,
        ) => {
          setTimeout(() => error?.({ code: 3, message: 'timeout' } as GeolocationPositionError), 0);
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
  }, mode);
}

async function openEarthSheet(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'موقعیت من روی زمین' }).click();
}

async function readCounts(page: Page): Promise<{ high: number; coarse: number }> {
  return page.evaluate(
    () =>
      (window as unknown as { __geoCounts: { high: number; coarse: number } }).__geoCounts ?? {
        high: 0,
        coarse: 0,
      },
  );
}

test.describe('simulated browser geolocation', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 30.0444, longitude: 31.2357, accuracy: 25 },
  });

  test('granted simulated position reaches the Earth marker', async ({ page }) => {
    const errors = trackPageErrors(page);
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();
    await expect(page.getByRole('button', { name: /موقعیت شما/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('geolocation failure and privacy diagnostics', () => {
  test('permission denied is explicit and leaves manual entry available', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'denied');
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();
    await expect(page.getByRole('alert')).toContainText('اجازهٔ موقعیت داده نشد');
    await expect(page.getByRole('button', { name: 'ورود مختصات دستی' })).toBeVisible();
    expect(await readCounts(page)).toEqual({ high: 1, coarse: 0 });
  });

  test('timeout uses exactly one coarse fallback and reports failure', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'timeout');
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();
    await expect(page.getByRole('alert')).toContainText('دریافت موقعیت طول کشید');
    expect(await readCounts(page)).toEqual({ high: 1, coarse: 1 });
  });

  test('coarse fallback can provide a reported low-accuracy fix', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'coarse-success');
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();
    const location = page.getByRole('button', { name: /موقعیت شما/ });
    await expect(location).toBeVisible();
    await expect(location).toContainText('۹۰۰');
    expect(await readCounts(page)).toEqual({ high: 1, coarse: 1 });
  });

  test('unavailable is reported without inventing a position', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'unavailable');
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();
    await expect(page.getByRole('alert')).toContainText('موقعیت در دسترس نیست');
    expect(await readCounts(page)).toEqual({ high: 1, coarse: 1 });
  });

  test('insecure Earth context rejects geolocation before calling the browser API', async ({
    page,
  }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'denied');
    await page.addInitScript(() => {
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        configurable: true,
      });
    });
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();
    await expect(page.getByRole('alert')).toContainText('HTTPS', { timeout: 3_000 });
    expect(await readCounts(page)).toEqual({ high: 0, coarse: 0 });
  });

  test('unsupported geolocation leaves manual coordinates available', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'unsupported');
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();
    await expect(page.getByRole('alert')).toContainText('پشتیبانی نمی‌کند');
    await page.getByRole('button', { name: 'ورود مختصات دستی' }).click();
    await page.getByPlaceholder('مثلاً 35.6892').fill('30.0444');
    await page.getByPlaceholder('مثلاً 51.3890').fill('31.2357');
    await page.getByRole('button', { name: 'ثبت این مختصات روی زمین' }).click();
    await expect(page.getByRole('button', { name: /موقعیت شما/ })).toBeVisible();
  });

  test('manual locations are not persisted to localStorage or sessionStorage', async ({
    page,
  }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'ورود مختصات دستی' }).click();
    await page.getByPlaceholder('مثلاً 35.6892').fill('30.0444');
    await page.getByPlaceholder('مثلاً 51.3890').fill('31.2357');
    await page.getByRole('button', { name: 'ثبت این مختصات روی زمین' }).click();
    const storage = await page.evaluate(() => ({
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
    }));
    expect(storage.local).not.toContain('30.0444');
    expect(storage.session).not.toContain('30.0444');
    expect(storage.local).not.toContain('31.2357');
    expect(storage.session).not.toContain('31.2357');
  });

  test('manual entry works when the browser API is unavailable', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'unsupported');
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'ورود مختصات دستی' }).click();
    await page.getByPlaceholder('مثلاً 35.6892').fill('30.0444');
    await page.getByPlaceholder('مثلاً 51.3890').fill('31.2357');
    await page.getByRole('button', { name: 'ثبت این مختصات روی زمین' }).click();
    await expect(page.getByRole('button', { name: /موقعیت شما/ })).toBeVisible();
  });

  test('Earth and Sky share an already selected location', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'ورود مختصات دستی' }).click();
    await page.getByPlaceholder('مثلاً 35.6892').fill('30.0444');
    await page.getByPlaceholder('مثلاً 51.3890').fill('31.2357');
    await page.getByRole('button', { name: 'ثبت این مختصات روی زمین' }).click();
    await page.getByRole('button', { name: 'آسمان واقعی' }).click();

    await expect(page.getByTestId('sky-hud')).toContainText('۳۰٫۰۴۴');
    await expect(page.getByTestId('sky-hud')).toContainText('۳۱٫۲۳۶');
  });

  test('Sky location is visible when returning to Earth', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await openApp(page);
    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    await page.getByRole('button', { name: 'ورود مختصات به‌صورت دستی' }).click();
    await page.getByPlaceholder('مثلاً 35.6892').fill('30.0444');
    await page.getByPlaceholder('مثلاً 51.3890').fill('31.2357');
    await page.getByRole('button', { name: 'استفاده از این مکان' }).click();
    await expect(page.getByTestId('sky-hud')).toBeVisible();

    await page.getByRole('button', { name: 'کاوش آزاد' }).click();
    await expect(page.getByRole('button', { name: /موقعیت شما/ })).toContainText(
      '۳۰٫۰۴۴',
    );
  });

  test('Sky rejects insecure context before calling geolocation', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        configurable: true,
      });
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (
            _success: PositionCallback,
            error?: PositionErrorCallback | null,
          ) => {
            setTimeout(
              () => error?.({ code: 1, message: 'denied' } as GeolocationPositionError),
              0,
            );
          },
          watchPosition: () => 1,
          clearWatch: () => undefined,
        },
      });
    });
    await blockOsm(page);
    await openApp(page);
    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    await expect(
      page.getByRole('heading', { name: 'آسمان از کجا دیده می‌شود؟' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'استفاده از موقعیت فعلی' }).click();

    await expect(page.getByRole('alert')).toContainText('HTTPS', { timeout: 3_000 });
    await expect(
      page.getByRole('button', { name: 'ورود مختصات به‌صورت دستی' }),
    ).toBeVisible();
  });

  test('Sky reports permission denial without an automatic retry', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'denied');
    await openApp(page);
    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    await page.getByRole('button', { name: 'استفاده از موقعیت فعلی' }).click();

    await expect(page.getByRole('alert')).toContainText('اجازهٔ موقعیت داده نشد');
    expect(await readCounts(page)).toEqual({ high: 1, coarse: 0 });
    await page.waitForTimeout(1_000);
    expect(await readCounts(page)).toEqual({ high: 1, coarse: 0 });
  });

  test('a known denied permission is not sent to the browser API', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'denied');
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value: {
          query: async () => ({ state: 'denied' }),
        },
      });
    });
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();

    await expect(page.getByRole('alert')).toContainText('اجازهٔ موقعیت داده نشد');
    expect(await readCounts(page)).toEqual({ high: 0, coarse: 0 });
  });

  test('a coarse fix is recorded without auto-focusing the globe', async ({ page }) => {
    await installFixedDate(page);
    await blockOsm(page);
    await installGeoMock(page, 'coarse-success');
    await openApp(page);
    await dismissHint(page);
    await openEarthSheet(page);
    await page.getByRole('button', { name: 'دریافت موقعیت دستگاه' }).click();

    await expect(page.getByText(/زوم روی محدودهٔ نامطمئن/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'موقعیت من' })).toBeVisible();
    await expect(page.locator('.earth-map-status')).toHaveCount(0);
    expect(await readCounts(page)).toEqual({ high: 1, coarse: 1 });

    await page.getByRole('button', { name: 'بستن', exact: true }).click();
    await expect(page.getByRole('button', { name: /موقعیت شما/ })).toContainText(
      '۹۰۰',
    );
  });
});
