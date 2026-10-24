# مأموریت ۰۱۱ — گزارش یکپارچگی M1 + M2

> تاریخ: ۲۰۲۶-۱۰-۲۵ · شاخه: `mission-011-integration` · مبنا: `9ef2c75` (M2)
> `main` همچنان `bb08d1c` است. هیچ merge به `main` و هیچ deploy یا انتشار
> GitHub Pages انجام نشده است.

## ۱. پاسخ کوتاه

- **بله، M1 و M2 در یک نسخهٔ واحد هستند.** M2 مستقیماً روی M1 ساخته شده است و
  `git merge-base --is-ancestor mission-009-m1-ui mission-010-m2-navigation`
  موفق است؛ همهٔ commitها و فایل‌های M1 در M2 وجود دارند.
- M1 و M2 history خطی و بدون انشعاب متقابل دارند؛ بنابراین merge conflict واقعی
  وجود نداشت. شاخهٔ یکپارچه از M2 ساخته شد و فقط تست و مستندات audit به آن اضافه شد.
- هیچ dependency جدیدی اضافه نشده، هیچ فایلی حذف نشده و `main` تغییر نکرده است.
- **مورد مسدودکنندهٔ انتشار وجود ندارد.** یک ناپایداری زمانی موقت در اجرای اول
  E2E دیده شد و در بخش ۴ ثبت شده است؛ کد یا assertionای برای سبز شدن تغییر نکرد.
- تست یکپارچگی جدید: `ff6ff34` · commit گزارش/مستندات: همین commit.

## ۲. وضعیت Git و commitها

| شاخه/نسخه | HEAD | commitهای شاخص | رابطه |
| --- | --- | --- | --- |
| `main` / `origin/main` | `bb08d1c` | گزارش فاز ۱ | مبنا، بدون تغییر |
| `mission-009-m1-ui` | `b854b0e` | `2e60c83` UI، `b854b0e` گزارش | ۲ commit روی main |
| `mission-010-m2-navigation` | `9ef2c75` | `61d5877` ناوبری، `9ef2c75` گزارش | شامل M1 به‌صورت کامل |
| `mission-011-integration` | گزارش همین commit | `ff6ff34` تست یکپارچگی | از M2 |

- `git diff --stat main..mission-010-m2-navigation`: ۴۱ فایل، ۱۹۲۸ insertion،
  ۲۱۲ deletion. M1 و M2 هر دو در این تفاوت حاضرند.
- `git diff --diff-filter=D --name-only main..HEAD`: خالی؛ هیچ فایلی حذف نشده است.
- `git diff --stat main..HEAD -- package.json package-lock.json`: خالی؛ وابستگی
  تغییر نکرده است.
- فایل‌های کلیدی M1 که M2 آن‌ها را تغییر نداده و دست‌نخورده باقی مانده‌اند:
  `src/components/Sheet.tsx`، `src/components/Sheet.test.tsx`،
  `src/styles/base.css`، `src/styles/tokens.css`،
  `src/features/sky-view/ObserverSetup.tsx`،
  `src/features/free-explore/EarthLocationSheet.tsx` و
  `e2e/ui-foundation.spec.ts`.
- `src/app/App.tsx` هر دو مجموعه را دارد: skip-link، `h1`، `main` و
  settings از M1؛ mount هم‌زمان Free/Sky با prop `active` از M2.
- `src/app/appState.ts` انتخاب nullable و مستقل هر mode را از M2 دارد؛
  `Sheet.tsx` و توکن‌های دسترس‌پذیری M1 بدون تغییرند.
- تست ائتلافی جدید `diagnostics/integration.spec.ts` است و هیچ تست قبلی حذف،
  skip یا weaken نشده است.

## ۳. چه چیزهایی در نسخهٔ یکپارچه حفظ شدند

### M1 — UI و دسترس‌پذیری

- focus trap، `inert` پس‌زمینه، بازگرداندن focus و بستن با `Escape` در
  `Sheet.tsx` دست‌نخورده است.
- حداقل هدف لمسی `44px`، مقیاس تایپوگرافی `12/13/14px`، skip link، یک `h1` و
  landmark اصلی حفظ شده‌اند.
- چیدمان شش viewport بدون overflow صفحه و بدون overlap کنترلها در
  `e2e/ui-foundation.spec.ts` سبز است.
- تمام کنترل‌های اصلی و Sheetها در اندازهٔ لمسی باقی مانده‌اند.

### M2 — ناوبری و حفظ وضعیت

- شروع Free بدون انتخاب اجباری Earth؛ هر دو mode می‌توانند بدون انتخاب باشند.
- انتخاب Free و Sky جدا و nullable است و در رفت‌وبرگشت حالت reset نمی‌شود.
- هر دو mode mount می‌مانند؛ mode غیرفعال `hidden` و pause می‌شود.
- حافظهٔ pose هر جرم: Earth→Moon→Earth نمای نزدیک Earth را برمی‌گرداند.
- orbit/pan/zoom با ماوس و لمس، و میانبرهای مستند کیبورد در Free.
- تنظیمات علمی، نورپردازی، LocationService، نقشه، کاشی‌ها و بافت زمین تغییر
  نکرده‌اند.

## ۴. نتایج دقیق تست‌ها

| بررسی | نتیجه |
| --- | --- |
| Vitest unit | **۱۸۳/۱۸۳ در ۳۱ فایل** |
| Playwright E2E | **۱۱/۱۱ در اجرای کامل دوم** (۹٫۹ دقیقه) |
| Browser diagnostics | **۴۳/۴۳**؛ ۰ expected-fail |
| ↳ ناوبری و state | ۷/۷ |
| ↳ cache | ۸/۸ |
| ↳ geolocation + environment | ۱۶/۱۶ |
| ↳ visual regression | ۱۱/۱۱؛ ۱۲ baseline |
| ↳ integration audit | ۱/۱ (۵۷ ثانیه) |
| Astronomy diagnostics | ۱۴/۱۴ |
| Diagnostics typecheck | سبز |
| `typecheck` | سبز |
| `lint` | بدون خطا و warning |
| `build` | موفق |
| GitHub Pages base-path build + `check:pages` | موفق؛ ۵ ارجاع محلی و دارایی‌های Earth detail تأیید شد |

- E2E گروهی نیز مستقل اجرا شد: `mobile.spec.ts` **۸/۸** و
  `ui-foundation.spec.ts` **۳/۳**. اجرای اول کامل، دو شکست زمانی در
  assertionهای ۴۰ و ۲۰ ثانیه‌ای داشت؛ هر دو تست بدون هیچ تغییر کد یا assertion
  به‌صورت هدفمند و سپس کل suite در اجرای دوم **۱۱/۱۱** سبز شد. این ناپایداری
  محیط SwiftShader است، نه رگرسیون M1/M2.
- visualها بدون `--update-snapshots` و در برابر baselineهای M2 مقایسه شدند؛
  baseline اولیه دیگر Earth انتخاب‌شده ندارد. تصاویر شش viewport در تست
  integration، artifactهای audit جداگانه‌اند و baseline جدید نیستند.

## ۵. بازبینی عملی و viewportها

- اندازه‌های **۳۲۰×۵۶۸، ۳۹۰×۸۴۴، ۷۶۸×۱۰۲۴، ۸۴۴×۳۹۰، ۱۲۸۰×۸۰۰ و
  ۱۹۲۰×۱۰۸۰** در Free و Sky بررسی شدند: `scrollWidth` از viewport بیشتر نشد،
  فقط یک mode panel فعال بود و کنترل‌های پایین داخل viewport ماندند.
- در ۳۲۰px ردیف اجرام Sky به‌صورت افقی اسکرول می‌شود (رفتار عمدی
  `overflow-x: auto`)؛ این اسکرول داخلی است و overflow صفحه ایجاد نمی‌کند.
- شروع سایت: `aria-pressed` برای هیچ جرمی فعال نیست.
- Earth→Moon→Earth: انتخاب Earth و «جزئیات نقشه فعال» حفظ شد.
  تصویر `earth-close-390` و `earth-restored-390` **بایت‌به‌بایت یکسان** هستند
  (SHA-256: `b127f605ac79dc7d0c9dcd89185f84068965104111083d44e389ab385a03892a`).
- Free→Sky→Free: پس از بازگشت، Earth انتخاب‌شده و جزئیات نقشه باقی ماندند.
- ماوس، لمس (CDP)، صفحه‌کلید، `Home`، `Digit2`، focus trap، اندازهٔ کنترل‌ها و
  نبود overflow در تست‌ها سبزند.
- تست integration هیچ `pageerror`، `console.error` یا درخواست شبکهٔ ناموفق
  غیر از OSM mock ندید. OSM در تست mock می‌شود؛ هیچ ترافیک واقعی به آن ارسال نشد.

## ۶. Screenshotهای نهایی

Free در شش اندازه:

- 320×568: `C:/tmp/m011-free-320x568.png`
- 390×844: `C:/tmp/m011-free-390x844.png`
- 768×1024: `C:/tmp/m011-free-768x1024.png`
- 844×390: `C:/tmp/m011-free-844x390.png`
- 1280×800: `C:/tmp/m011-free-1280x800.png`
- 1920×1080: `C:/tmp/m011-free-1920x1080.png`

Sky در شش اندازه:

- 320×568: `C:/tmp/m011-sky-320x568.png`
- 390×844: `C:/tmp/m011-sky-390x844.png`
- 768×1024: `C:/tmp/m011-sky-768x1024.png`
- 844×390: `C:/tmp/m011-sky-844x390.png`
- 1280×800: `C:/tmp/m011-sky-1280x800.png`
- 1920×1080: `C:/tmp/m011-sky-1920x1080.png`

چرخه‌ها در ۳۹۰×۸۴۴:

- Earth close: `C:/tmp/m011-earth-close-390.png`
- Earth restored: `C:/tmp/m011-earth-restored-390.png`
- Free restored after Sky: `C:/tmp/m011-free-restored-390.png`

تصاویر قبل از M2 و شواهد M2 نیز در
`C:/tmp/m009-final-free-390.png`، `C:/tmp/m010-after-initial-390.png` و
`C:/tmp/m010-after-free-restored-390.png` باقی مانده‌اند.

## ۷. محدودیت‌ها

- آزمون با Chrome headless و SwiftShader انجام شده است؛ آزمون دستگاه فیزیکی
  (GPS/حسگر/دوربین/iOS Safari) انجام نشده است.
- لمس با CDP شبیه‌سازی شده است، نه لمس واقعی.
- OSM در همهٔ تست‌ها mock است؛ کیفیت/دسترس‌پذیری شبکهٔ واقعی OSM بررسی خودکار نشده
  است. درخواست تصویر NASA از دارایی محلی برنامه است.
- ناوبری حول target است و 6DOF کامل نیست؛ state فقط در همان نشست مرورگر حفظ
  می‌شود؛ پس از اشتراک مکان ممکن است Free و Sky دو WebGL context داشته باشند
  (حلقهٔ hidden متوقف است، اما حافظه باقی می‌ماند).
- اجرای اول E2E ناپایداری زمانی داشت؛ جزئیات و نتیجهٔ اجرای دوم در بخش ۴ آمده
  است. هیچ timeout یا assertionای برای سبز شدن تغییر نکرد.

## ۸. Git نهایی

- شاخه: `mission-011-integration`
- مبنا: `9ef2c75` (M2، شامل M1)
- تست یکپارچگی: `ff6ff34` — `test(diagnostics): audit M1+M2 integration across viewports`
- مستندات/گزارش: همین commit
- push فقط روی همین شاخه
- `main` بدون تغییر (`bb08d1c`) و بدون merge/deploy
