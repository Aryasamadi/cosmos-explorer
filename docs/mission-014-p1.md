# مأموریت ۰۱۴ — P1: صحت علمی و بصری

> مبنا: `main` منتشرشده در `5a8be1e` · شاخه: `mission-014-p1-correctness`
> پیگیری اصلاحی: شاخهٔ `mission-014-p1-attribution-fix` (۰۱۴٫۱)
> **به‌روزرسانی ۰۱۵:** مدل «نور نمایشی وابسته به دوربین» این گزارش با نور فیزیکی
> `body→Sun` جایگزین شد؛ `moonPhase.ts` و `updateMoonLighting(camera)` حذف شدند.
> بخش ۲ این سند تاریخی است؛ رفتار فعلی در
> [mission-015-physical-sunlight.md](mission-015-physical-sunlight.md) آمده است.
> این گزارش فقط P1 را ثبت می‌کند: بدون بازطراحی دوربین، 6DOF، مقیاس کیهانی یا
> شروع P2/P3. هیچ merge یا deploy انجام نشده است.

## ۱. دامنه

P1 هفت مورد را پوشش داد: هم‌ترازی فاز نمایشی ماه با فاز ژئومرکزی، نورپردازی
روز/شب لایهٔ OSM و امکان خاموش‌کردن آن، attribution شرطی، جای‌گذاری ریل/کنترل‌ها،
برچسب اجرام، تعامل مقیاس روی موبایل، و اصلاح مستندات مکان مشترک. معماری ناوبری و
حالت‌های M1/M2 دست‌نخورده ماندند.

## ۲. فاز ماه (تاریخی؛ در ۰۱۵ با نور فیزیکی جایگزین شد)

### ریشهٔ مشکل

فاصله‌های نمایشی فشرده‌اند (ماه ۵٫۸ و خورشید ۳۴ واحد) و دوربین overview در فاصلهٔ
۷٫۴ قرار می‌گیرد؛ بنابراین دوربین تقریباً هم‌فاصله با مدار فشردهٔ ماه است. نور
صحنه در این هندسه فاز **از دید دوربین** را نشان می‌داد، نه فاز ژئومرکزی. مثال
محاسباتی در `2026-10-25T14:26Z`:

| کمیت | مقدار |
| --- | --- |
| فاز مرجع Astronomy Engine | `0.994254` (≈۹۹٫۴٪) |
| فاصلهٔ دوربین تا ماه | `3.45` واحد |
| dot «دوربین→ماه» و «ماه→خورشید» | `-0.480` |
| کسر روشن دیده‌شده از دوربین (قبل) | ≈`0.260` → هلال |

### راه‌حل فنی

`src/engine/free/moonPhase.ts` یک جهت نور نمایشی می‌سازد:

- بردار دید `v` (ماه→دوربین) و بردار خورشید `s` (ماه→خورشید) را می‌گیرد.
- مؤلفهٔ عمود بر دید را از جهت تصویر خورشید می‌سازد.
- `cos θ = 2f - 1` و `sin θ = sqrt(1 - cos²θ)` را با فاز ژئومرکزی `f` ترکیب می‌کند.
- نتیجه: `dot(v, light) = 2f - 1` و کسر روشن دیده‌شده از دوربین **دقیقاً** `f`
  است. جهت لبهٔ روشن از تصویر خورشید در دوربین می‌آید.
- `solarSystem.updateMoonLighting(camera)` این جهت را هر فریم روی material ماه
  اعمال می‌کند. نور خورشید صحنه برای زمین، مریخ و ترتیب کلی صحنه تغییر نکرده است.

این مدل آگاهانه یک **مدل نمایشی** برای صحنهٔ فشرده است؛ نه نور فیزیکی صحنه. در
حالت focus، دوربین روی سمت Earth-facing است و همین مدل با فاز ژئومرکزی سازگار
می‌ماند.

### اندازه‌گیری خطا

اختلاف فاز frame با مرجع در تاریخ‌های تست:

| تاریخ UTC | مرجع | frame | اختلاف |
| --- | --- | --- | --- |
| 2026-01-15T09:00Z | 0.111570 | 0.111570 | 0.000000 |
| 2026-06-21T12:00Z | 0.458314 | 0.458314 | 0.000000 |
| 2026-09-23T00:00Z | 0.858252 | 0.858252 | 0.000000 |
| 2026-10-25T14:26Z | 0.994254 | 0.994254 | 0.000000 |
| 2026-10-24T22:30Z | 0.978959 | 0.978959 | 0.000000 |

- تست `referenceFrame.test.ts` خطای frame/مرجع را برای تاریخ‌های تست کمتر از
  `0.001` نگه می‌دارد.
- تست `moonPhase.test.ts` کسر روشن دیده‌شده را برای کسرهای ۰ تا ۱ و چند جهت دید
  با دقت ۱۰ رقم اعشار برابر ورودی می‌سنجد.
- باقی‌ماندهٔ مدل: جهت لبهٔ روشن تقریبی است و pixel intensity به دلیل ambient و
  tone mapping دقیقاً خطی نیست؛ این photometry نیست.

## ۳. OSM روز/شب، خاموش‌کردن لایه و attribution

- material کاشی‌های OSM از `MeshBasicMaterial` به `ShaderMaterial` تغییر کرد و
  با `uSunDirection` محلی، ضریب روز را با `smoothstep(-0.10, 0.14, sunDot)`
  محاسبه می‌کند. نیم‌کرهٔ شب با ضریب `0.24, 0.30, 0.44` تیره و آبی می‌شود.
- `globeTiles.setEnabled()` اضافه شد. سوییچ «نقشهٔ خیابانی OpenStreetMap» در برگهٔ
  «موقعیت من» لایه را خاموش/روشن می‌کند؛ در حالت خاموش، کاشی‌ها و درخواست‌ها
  متوقف و attribution اصلی مخفی می‌شوند. لایهٔ NASA و کرهٔ پایه باقی می‌مانند.
- `mapAttributionVisible` فقط با لایهٔ فعال/در حال بارگذاری/خطا نمایش داده
  می‌شود؛ این شرط هم attribution اصلی گوشهٔ نقشه و هم attribution و
  لینک‌های مجوز/سیاست OSM داخل برگهٔ تنظیمات را کنترل می‌کند. در حالت خاموش یا
  idle هیچ لینک OSM در برگه نمایش داده نمی‌شود. (اصلاح ۰۱۴٫۱)
- در آزمون زنده: overview بدون attribution، با نقشهٔ فعال attribution ۱، با
  خاموش‌کردن ۰، و با روشن‌کردن دوباره ۱ شد. کاشی‌های mock همه ۲۰۰؛ خطای
  کنسول/شبکه نداشت.
- محدودیت باقی‌مانده: بارگذاری تدریجی کاشی‌ها می‌تواند در شبکهٔ کند چند ثانیه
  ناحیهٔ مستطیلی/ناقص نشان دهد؛ رفع کامل پوشش و پاپ‌این به P5 (نقشه) موکول شد.

## ۴. برچسب‌ها، ریل، مقیاس

- چهار برچسب کوچک زمین/ماه/خورشید/مریخ با CSS2DRenderer اضافه شد. برچسب‌ها
  `pointer-events:none` دارند، در accessibility مخفی‌اند، و فقط وقتی در کادر امن
  دید هستند نمایش داده می‌شوند؛ برچسب‌های لبه/پشت دوربین پنهان می‌شوند.
- باگ RTL CSS2DRenderer برطرف شد: عناصر absolute در RTL از لبهٔ راست شروع
  می‌شدند و transform دوباره اضافه می‌شد؛ `left:0; right:auto` برای برچسب‌های
  Free و Sky اضافه شد.
- ریل اجرام در دسکتاپ از ستون میانی چپ به dock پایین منتقل شد؛ در ۱۲۸۰/۱۹۲۰
  دیگر روی ماه نمی‌افتد. در موبایل همان چیدمان پایین حفظ شد.
- «مقیاس نمایشی» از یک note غیرقابل‌لمس به دکمهٔ `aria-expanded`/`aria-controls`
  تبدیل شد. لمس (CDP/Playwright)، کلیک ماوس، Enter و Escape تست شدند؛ popover در
  ۳۲۰px داخل viewport و بدون overflow است.
- در ۳۲۰px، برچسب خورشید اگر نزدیک لبه باشد پنهان می‌شود تا بریده نشود.

## ۵. مستندات

- `docs/earth-geography.md`: مکان به‌درستی **مشترک** بین زمین و آسمان توصیف شد
  (متن قدیمی «مستقل» اصلاح شد)؛ رفتار شبانهٔ OSM و سوییچ لایه مستند شد.
- `docs/astronomy-model.md`: مدل فاز نمایشی ماه، خطای frame و باقی‌ماندهٔ
  photometry ثبت شد.
- `docs/navigation.md`: برچسب اجرام، دکمهٔ مقیاس و لایهٔ نقشه اضافه شد.
- `README.md` و `docs/testing.md` شمارش تست‌ها و P1 را به‌روز کردند.

## ۶. تست‌ها و اعتبارسنجی

| بررسی | نتیجه |
| --- | --- |
| Vitest unit | **۲۰۱/۲۰۱ در ۳۲ فایل** |
| Playwright E2E | **۱۱/۱۱** |
| Browser diagnostics (P1) | **۴۵/۴۵**؛ ۰ expected-fail |
| ↳ ناوبری | ۷/۷ |
| ↳ cache | ۸/۸ |
| ↳ geolocation + environment | ۱۶/۱۶ |
| ↳ visual regression | ۱۱/۱۱ (۱۲ baseline) |
| ↳ integration | ۱/۱ |
| ↳ P1 | ۲/۲ |
| Astronomy diagnostics | ۱۴/۱۴ |
| Diagnostics typecheck | سبز |
| `typecheck` / `lint` | سبز / بدون خطا و warning |
| `build` + Pages base path + `check:pages` | موفق |

- visual regression با `prefers-reduced-motion` اجرا شد تا انیمیشن WebGL/دوربین
  باعث ناپایداری screenshot نشود؛ assertionها و آستانه‌ها تغییر نکردند.
- اجرای نهایی ۰۱۴٫۱ (۲۰۲۶-۱۰-۲۸) روی شاخهٔ `mission-014-p1-attribution-fix`:
  Vitest **۲۰۱/۲۰۱**، E2E **۱۱/۱۱** با سقف پیش‌فرض ۱۲۰s (۷٫۳m)، visual
  **۱۱/۱۱** (یک screenshot-stability timeout محیطی در `initial-320` و پاس
  هدفمند همان تست بدون تغییر کد)، P1 **۲/۲** (۱٫۸m)، diagnostics typecheck و
  Astronomy **۱۴/۱۴** سبز.
- در اجرای P1، تست E2E `bundled satellite detail...` و `daylit land...` در اجرای
  کامل با سقف پیش‌فرض ۱۲۰ ثانیه در محیط SwiftShader یک timeout محیطی داشتند؛ هر
  دو در اجرای هدفمند و اجرای کامل نهایی با timeout محیطی ۱۸۰ ثانیه (بدون تغییر
  فایل تست یا assertion) سبز شدند. هیچ assertion یا timeoutی برای سبز شدن تغییر
  نکرد. در اجرای ۰۱۴٫۱ هر ۱۱ تست با همان سقف پیش‌فرض ۱۲۰ ثانیه سبز شدند.
- شش viewport در Free و Sky با integration بررسی شد؛ overflow صفر و فقط یک mode
  panel فعال بود. M1 focus trap/inert و M2 state/pose بدون رگرسیون ماندند.

## ۷. Screenshotها

قبل/بعد، تاریخ ثابت `2026-06-21T12:00Z` (نسخهٔ قدیمی از سایت زندهٔ `5a8be1e` و
نسخهٔ جدید از شاخهٔ P1):

- قبل: `C:/tmp/m014-before-free-320x568.png`، `m014-before-free-390x844.png`،
  `m014-before-free-768x1024.png`، `m014-before-free-844x390.png`،
  `m014-before-free-1280x800.png`، `m014-before-free-1920x1080.png`
- بعد: `C:/tmp/m014-free-320x568.png`، `m014-free-390x844.png`،
  `m014-free-768x1024.png`، `m014-free-844x390.png`، `m014-free-1280x800.png`،
  `m014-free-1920x1080.png`

فاز ماه:

- قبل هلال: `C:/tmp/m014-before-phase-crescent-1280.png`
- بعد هلال: `C:/tmp/m014-phase-crescent-1280.png`
- بعد هلال در focus: `C:/tmp/m014-phase-crescent-focus-1280.png`
- قبل gibbous: `C:/tmp/m014-before-phase-gibbous-1280.png`
- بعد gibbous: `C:/tmp/m014-phase-gibbous-1280.png`
- بعد gibbous در focus: `C:/tmp/m014-phase-gibbous-focus-1280.png`

نقشه و مقیاس:

- شب با OSM فعال (تیره): `C:/tmp/m014-map2-night-on-390.png`
- شب با OSM خاموش: `C:/tmp/m014-map2-night-off-390.png`
- روز با OSM فعال: `C:/tmp/m014-map-day-on-390.png`
- لایهٔ نقشه و attribution: `C:/tmp/m014-map2-night-on-390.png`
- popover مقیاس در ۳۲۰px: `C:/tmp/m014-scale-tap-320.png`
- baselineهای جدید: `diagnostics/baselines/win32/initial-390.png`،
  `earth-day-390.png`، `earth-night-390.png`، `moon-390.png`،
  `moon-gibbous-390.png`، `tile-loading-390.png`، `tile-error-390.png`

## ۸. محدودیت‌ها

- مدل فاز ماه یک مدل نمایشی برای صحنهٔ فشرده است؛ جهت لبهٔ روشن تقریبی و
  روشنایی پیکسلی تحت tone mapping است. مقیاس واقعی و مدارهای واقعی در P3.
- OSM هنوز یک overlay دو‌بعدی است؛ بارگذاری تدریجی/پوشش کامل viewport و انتخاب
  provider در P5. در شبکهٔ ضعیف ممکن است چند ثانیه ناحیهٔ ناقص دیده شود.
- برچسب‌ها برای جلوگیری از شلوغی/بریدگی در لبه‌ها پنهان می‌شوند؛ در برخی
  موقعیت‌های ephemeris ممکن است یک جرم در لبه بدون برچسب باشد ولی pill آن در
  dock پایین همیشه هست.
- آزمون دستگاه فیزیکی (GPS/حسگر/دوربین/iOS) انجام نشده؛ performance موبایل
  همچنان UNVERIFIED است.
- هیچ تغییر 6DOF/scale/camera architecture انجام نشد؛ این‌ها P2/P3 هستند.
- هیچ merge به `main` و هیچ deploy انجام نشده است.

## ۹. فایل‌های تغییرکرده

- فاز ماه: `src/engine/free/moonPhase.ts`، `moonPhase.test.ts`،
  `solarSystem.ts`، `FreeExploreScene.ts`، `referenceFrame.test.ts`.
- نقشه/attribution: `globeTiles.ts`، `FreeExploreMode.tsx`،
  `EarthLocationSheet.tsx`، `EarthLocationSheet.test.tsx`.
- UI/هندسه: `m1-foundation.css`، `FreeExploreMode.tsx`.
- تست‌ها: `diagnostics/p1.spec.ts`، `diagnostics/visual.spec.ts`،
  `diagnostics/baselines/win32/*.png`، `src/app/App.test.tsx`.
- مستندات: `docs/astronomy-model.md`، `docs/earth-geography.md`،
  `docs/navigation.md`، `docs/testing.md`، `README.md`،
  `diagnostics/README.md` و همین گزارش.

## ۱۰. Git

- شاخه: `mission-014-p1-correctness`
- مبنا: `main` / `origin/main` در `5a8be1e`
- commit پیاده‌سازی/تست: `456fbbf`
- commit مستندات/گزارش: همین commit
- پیگیری ۰۱۴٫۱: شاخهٔ `mission-014-p1-attribution-fix` از `075c159`؛ فقط
  conditional کردن attribution برگه و تست on/off/error
- push فقط روی همین شاخه‌ها
- `main` بدون تغییر
