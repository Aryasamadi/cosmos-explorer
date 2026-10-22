import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
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
