# Diagnostics (Phase 0 + Phase 1)

این پوشه از تست‌های production و CI معمول جداست. فاز ۰ رفتار نسخهٔ ۰٫۴٫۰ را ثبت
کرد؛ فاز ۱ هم‌ترازی علمی نور/فاز و LocationService مشترک را با همان ابزارها می‌سنجد؛
M2 نیز چهار نقص ناوبری را رفع کرد و تست‌هایشان اکنون pass عادی‌اند.

## اجرا

```bash
npm run test:diagnostics:typecheck
npm run test:diagnostics:astronomy
npm run test:diagnostics:browser
```

برای ساخت یا به‌روزرسانی baselineهای تصویری، فقط پس از بازبینی چشمی:

```bash
npm run test:diagnostics:update
```

- `test:diagnostics:browser` به یک dev server محلی روی `127.0.0.1:4173` نیاز دارد
  (پیکربندی آن را خودکار بالا می‌آورد).
- درخواست‌های OSM در همهٔ تست‌ها mock/abort می‌شوند؛ تست خودکار به سرویس واقعی
  OSM متصل نمی‌شود.
- تست‌های ناوبری M2 شامل state پایدار، camera pose، keyboard/mouse/touch و
  جزئیات focus هستند و اکنون pass عادی‌اند. هیچ تست expected-fail پنهان یا
  حذف نشده است.
- `installFixedDate(page, utc)` امکان اجرای هر سناریو در تاریخ UTC دلخواه را می‌دهد؛
  baselineهای دو فاز ماه در تاریخ‌های ۲۰۲۶-۰۶-۲۱ و ۲۰۲۶-۰۹-۲۳ ساخته شده‌اند.
- baselineهای تصویری با Chrome headless/SwiftShader، DPR=۱ و locale=`fa-IR` تولید
  شده‌اند. آن‌ها baseline دستگاه فیزیکی یا مرجع رنگ دقیق نیستند.
- baselineها در `diagnostics/baselines/<platform>/` قرار دارند. برای CI لینوکسی
  باید baseline جداگانه تولید شود؛ بنابراین این suite فعلاً gate انتشار نیست.

## مرزها

- این suite هیچ dependency، تصویر یا تنظیمات build را تغییر نمی‌دهد؛ فاز ۱ در
  `src/` تغییرات scientific/location داشت و همین تست‌ها آن‌ها را پوشش می‌دهند.
- network mock و geolocation شبیه‌سازی‌شده، جای آزمون واقعی OSM/GPS/دستگاه را
  نمی‌گیرند.
- نتیجهٔ WebGL در محیط SwiftShader با GPU موبایل قابل مقایسه نیست.

گزارش‌ها: [`docs/mission-006-diagnostics.md`](../docs/mission-006-diagnostics.md) و
[`docs/mission-007-phase1.md`](../docs/mission-007-phase1.md)
