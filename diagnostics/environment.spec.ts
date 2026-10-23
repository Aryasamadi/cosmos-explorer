import { expect, test } from '@playwright/test';
import { blockOsm, installFixedDate, openApp, readWebGlRenderer } from './helpers';

test('record browser and capability baseline without external traffic', async ({ page }) => {
  await installFixedDate(page);
  await blockOsm(page);
  await openApp(page);
  const renderer = await readWebGlRenderer(page);
  const environment = await page.evaluate(async () => {
    let permission = 'unavailable';
    try {
      permission = (await navigator.permissions.query({ name: 'geolocation' })).state;
    } catch {
      // Permissions API support varies by browser and context.
    }
    return {
      secureContext: window.isSecureContext,
      geolocationApi: typeof navigator.geolocation !== 'undefined',
      geolocationPermission: permission,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      language: navigator.language,
    };
  });

  test.info().annotations.push({
    type: 'environment',
    description: JSON.stringify({ renderer, ...environment }),
  });
  expect(renderer).not.toBe('webgl-unavailable');
});
