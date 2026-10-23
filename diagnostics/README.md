# Phase-0 diagnostics

این پوشه از تست‌های production و CI معمول جداست. هدف آن ثبت رفتار واقعی نسخهٔ
۰٫۴٫۰، بازتولید نقص‌های شناخته‌شده و ایجاد baseline تصویری برای فازهای بعدی است.

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
- تست‌های دارای `KNOWN DEFECT` با `test.fail`/`it.fails` علامت خورده‌اند. اگر بعداً
  رفتار production اصلاح شود، این تست‌ها به‌صورت «unexpectedly passed» شکست می‌خورند
  و باید آگاهانه به تست موفق تبدیل شوند.
- baselineهای تصویری با Chrome headless/SwiftShader، DPR=۱ و locale=`fa-IR` تولید
  شده‌اند. آن‌ها baseline دستگاه فیزیکی یا مرجع رنگ دقیق نیستند.
- baselineها در `diagnostics/baselines/<platform>/` قرار دارند. برای CI لینوکسی
  باید baseline جداگانه تولید شود؛ بنابراین این suite فعلاً gate انتشار نیست.

## مرزها

- این suite هیچ فایل production، dependency، تصویر یا تنظیمات build را تغییر نمی‌دهد.
- network mock و geolocation شبیه‌سازی‌شده، جای آزمون واقعی OSM/GPS/دستگاه را
  نمی‌گیرند.
- نتیجهٔ WebGL در محیط SwiftShader با GPU موبایل قابل مقایسه نیست.

گزارش تفصیلی: [`docs/mission-006-diagnostics.md`](../docs/mission-006-diagnostics.md)
