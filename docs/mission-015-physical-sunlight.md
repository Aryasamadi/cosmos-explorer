# مأموریت ۰۱۵ — نور فیزیکی خورشید

> مبنا: `main` ادغام‌شده در `67215c3` · شاخه: `mission-015-physical-sunlight`
> دامنه: فقط اصلاح نوردهی زمین/ماه/مریخ/OSM. ناوبری M1/M2، رابط کاربری، منطق مکان،
> مقیاس نمایشی و فاز P2 تغییر نکردند.

## ۱. خلاصه

در P1 مادهٔ ماه با `computeMoonDisplayLight(viewFromCamera, displaySun, referencePhase)`
روشن می‌شد و `FreeExploreScene` آن را در هر فریم با موقعیت دوربین بازنویسی می‌کرد.
نتیجه این بود که فاز روشن قرص برای هر دوربینی با فاز ژئومرکزی دلخواه برابر می‌ماند؛
یعنی نور ماه تابع دوربین بود، نه هندسهٔ خورشید و ماه.

در این مأموریت مسیر دوربین از نوردهی کاملاً حذف شد. جهت خورشید هر جسم فقط از frame
علمی مشترک می‌آید و یک‌بار در هر به‌روزرسانی نجومی (هر ۳۰ ثانیه) اعمال می‌شود.
`moonPhase.ts`، `computeMoonDisplayLight` و `updateMoonLighting(camera)` حذف شدند.

## ۲. قرارداد مختصات

`src/engine/free/physicalLighting.ts` سه جهت فیزیکی می‌سازد:

| مقصد | منبع در `ReferenceFrame` | frame شیدر |
| --- | --- | --- |
| زمین و OSM | `sun.directionFromEarth` | محلی زمین‌ثابت (ECEF نمایشی) |
| ماه | `moon.sunDirection` = `SunGeo − MoonGeo` | world صحنه |
| مریخ | `mars.sunDirection` = `SunGeo − MarsGeo` | world صحنه |

دلیل تفاوت frame: شیدر زمین و کاشی‌های OSM normal را در object space می‌خوانند، بنابراین
جهت خورشید باید در همان frame محلی زمین باشد. مادهٔ ماه/مریخ normal را با
`modelMatrix` به world می‌برد، بنابراین جهت خورشید با quaternion نمایشی به world صحنه
تبدیل می‌شود. این تبدیل فقط قرارداد نمایشی است و زاویه‌ها/فاز را حفظ می‌کند.

- `solarSystem.applyReferenceFrame` این جهت‌ها را روی uniformهای
  `earthMaterial`، `moonLit.sunDirection` و `marsLit.sunDirection` می‌گذارد.
- `earthSunDirection` مشترک بین کرهٔ پایه، لایهٔ جزئیات NASA و کاشی‌های OSM است؛
  `globeTiles.sunDirection` برای آزمون همین مرجع مشترک را آشکار می‌کند.
- هیچ‌یک از این مسیرها پارامتر دوربین ندارد. zoom/pan/orbit/انتخاب جرم فقط دوربین را
  جابه‌جا می‌کنند.

## ۳. فاز، ناظر و محدودیت مقیاس

کسر روشن یک کره:

```text
phase = (1 + dot(body→Sun, body→observer)) / 2
```

- برای ناظر مرکز زمین، `body→observer = −directionFromEarth`. این مقدار با
  `phaseFractionFromBodyState` و `Illumination(...).phase_fraction` مقایسه می‌شود و در
  شش تاریخ آزمون اختلاف کمتر از `0.001` دارد.
- `focusBody` برای ماه/مریخ دوربین را روی سمت Earth-facing می‌گذارد؛ در نتیجه فاز
  دیده‌شده با فاز ژئومرکزی مرجع سازگار است.
- در یک دوربین آزاد، فازِ دیده‌شده فاز همان ناظر است. چون فاصله‌های صحنه فشرده‌اند
  (ماه ۵٫۸ و خورشید ۳۴ واحد نمایشی، در برابر نسبت واقعی ماه ≈۰٫۰۰۲۶ AU)، این فاز
  می‌تواند با فاز ژئومرکزی متفاوت باشد. این اختلاف **پنهان نمی‌شود**؛ چرخاندن نور
  همراه دوربین برای حفظ فاز دلخواه، همان نقص P1 بود.
- موقعیت mesh خورشید نیز فشرده است و مبنای نوردهی نیست؛ بنابراین ممکن است جهت ظاهری
  mesh خورشید با جهت فیزیکی نور هر جسم اختلاف پارالاکس نشان دهد. رفع کامل به مقیاس
  واقعی در P3 موکول است.
- نوردهی برای آموزش/نمایش است، نه photometry؛ tone mapping و ambient، کسر فاز هندسی
  را در پیکسل‌ها کمی تغییر می‌دهند.

## ۴. تست‌ها

تست‌های قدیمی که فقط «فاز ثابت برای هر زاویهٔ دوربین» را تضمین می‌کردند حذف شدند و
جای آن‌ها تست‌های هندسی زیر آمد:

### Vitest — `src/engine/free/physicalLighting.test.ts`

- هر سه جهت با transform صحیح frame مطابقت دارند.
- تغییر فقط دوربین، هیچ جهت نوری را تغییر نمی‌دهد.
- جهت محلی زمین با نقطهٔ زیرخورشیدی مستقل هم‌راستاست (خطا < ۰٫۰۱°).
- فاز ماه و مریخ از دید ناظر زمینی در شش تاریخ با `Illumination` مقایسه می‌شود.
- با ۱۲ ساعت جابه‌جایی زمان، جهت‌ها مطابق frame تغییر می‌کنند.
- فاز دو ناظر مقابل هم مکمل یکدیگر است.
- بردارهای صفر رد می‌شوند.

### Browser diagnostics — `diagnostics/lighting.spec.ts`

- `window.__cosmosLighting` (فقط dev) جهت‌های واقعی uniformها، موقعیت ماه/مریخ و دوربین
  را برمی‌گرداند. این probe در build تولیدی حذف می‌شود.
- پس از orbit ۱۸۰°، zoom، pan و انتخاب ماه: موقعیت دوربین به‌طور محسوس تغییر می‌کند
  ولی جهت زمین/OSM/ماه/مریخ و موقعیت اجرام بیت‌به‌بیت ثابت می‌ماند.
- در دو تاریخ، جهت‌های صحنه با `computeReferenceFrame` و فاز ماه/مریخ از دید ناظر
  زمینی با `Illumination` مقایسه می‌شوند.
- جهت OSM با جهت محلی زمین برابر است.

### نتیجهٔ اجرای واقعی

| بررسی | نتیجه |
| --- | --- |
| Vitest | **۲۰۲/۲۰۲ در ۳۲ فایل** (۲۷٫۰s؛ اجرای نهایی) |
| Browser diagnostics | **۴۸/۴۸** (۳۰٫۲m، ۰ expected-fail) |
| ↳ lighting | ۳/۳ (۳۳٫۴s؛ نسخهٔ گستردهٔ orbit/zoom/pan/selection) |
| ↳ visual regression | ۱۱/۱۱ (۴٫۴m؛ هیچ baseline تغییر نکرد) |
| ↳ P1 | ۲/۲ |
| Astronomy diagnostics | ۱۴/۱۴ |
| Diagnostics typecheck | سبز |
| `typecheck` / `lint` | سبز / بدون خطا و warning |
| E2E | اجرای کامل اول با سقف ۱۲۰s: ۱۰/۱۱؛ تست heavy «bundled satellite detail» timeout محیطی ۲٫۴m خورد و همان تست هدفمند ۱/۱ در ۱٫۰m سبز شد. اجرای کامل نهایی با سقف محیطی ۱۸۰s: **۱۱/۱۱** در ۶٫۷m |
| `build` | موفق |
| Pages base path + `check:pages` | موفق؛ ۵ reference با `/cosmos-explorer/` |
| Preview مسیر Pages | HTTP 200، assetهای `index-BTNVCYsU.js`/`index-ZYbKu1Nu.css`، بدون console/pageerror، failed request یا پاسخ ≥۴۰۰ (OSM عمداً مسدود)؛ canvas ۳۹۰×۸۴۴؛ probe توسعه در bundle تولیدی وجود ندارد |

هیچ assertion یا timeout تستی برای سبز شدن تغییر نکرد. تست heavy جزئیات ماهواره‌ای
در اجرای کامل اول با سقف ۱۲۰s به timeout محیطی خورد و در اجرای هدفمند و اجرای
کامل نهایی با سقف ۱۸۰s (بدون تغییر فایل تست یا assertion) سبز شد.

## ۵. اسکرین‌شات‌های قبل/بعد

از سایت زندهٔ `67215c3` (قبل) و شاخهٔ اصلاح (بعد)، viewport ۳۹۰×۸۴۴، تاریخ‌های ثابت
`2026-06-21T12:00Z` و `2026-10-25T14:26Z`، در چهار زاویه: overview، overview پس از
۱۸۰°، ماه Earth-facing و ماه پس از ۱۸۰°.

- `C:/tmp/m015-before-2026-06-21-overview.png` / `m015-after-...`
- `C:/tmp/m015-before-2026-06-21-overview-opposite.png` / `m015-after-...`
- `C:/tmp/m015-before-2026-06-21-moon-earth-facing.png` / `m015-after-...`
- `C:/tmp/m015-before-2026-06-21-moon-opposite.png` / `m015-after-...`
- همان هشت تصویر برای `2026-10-25`.

مشاهدات:

- در نمای Earth-facing، قبل و بعد تقریباً یکسان‌اند (فاز مرجع حفظ می‌شود)؛ برای
  `2026-06-21` تصویر overview و ماه Earth-facing بایت‌به‌بایت یکسان بود.
- در تاریخ نزدیک به بدر `2026-10-25`، نمای Earth-facing در هر دو نسخه تقریباً کامل است؛
  اما پس از ۱۸۰° چرخش، نسخهٔ P1 همچنان ماه کامل نشان می‌داد (نور با دوربین چرخیده بود)
  و نسخهٔ اصلاح‌شده ماه تقریباً تاریک/نوزاد نشان می‌دهد (فاز فیزیکی ناظر مقابل).
- مرز روز/شب زمین در دو زاویهٔ overview با geography ثابت ماند؛ نمای overview تاریخ
  `2026-06-21` قبل/بعد بایت‌به‌بایت یکسان بود.

## ۶. محدودیت‌های باقی‌مانده

- فشرده‌سازی فاصله‌ها باعث می‌شود فاز دیده‌شده از دوربین آزاد با فاز ژئومرکزی یکی
  نباشد؛ این رفتار فیزیکی همان ناظر است، نه خطای نوردهی. مقیاس واقعی در P3.
- جهت نور ماه/مریخ از frame واقعی می‌آید ولی mesh خورشید در فاصلهٔ فشرده قرار دارد؛
  اختلاف پارالاکس ظاهری مستند شد.
- photometry واقعی (شدت، albedo، tone mapping) مدل نشده است.
- آزمون دستگاه فیزیکی/GPS/حسگر همچنان انجام نشده است.

## ۷. Git

- شاخه: `mission-015-physical-sunlight`
- مبنا: `main` / `origin/main` در `67215c3`
- commit پیاده‌سازی/تست: commit پیش از این سند
- commit مستندات/گزارش: همین commit
- push فقط روی شاخه، سپس fast-forward به `main` و انتشار Pages
- نتیجهٔ انتشار/asset زنده در گزارش نهایی مأموریت ثبت می‌شود.

## ۸. فایل‌های تغییرکرده

- جدید: `src/engine/free/physicalLighting.ts`، `physicalLighting.test.ts`،
  `diagnostics/lighting.spec.ts`، همین گزارش.
- حذف: `src/engine/free/moonPhase.ts`، `moonPhase.test.ts`.
- تغییر: `solarSystem.ts`، `FreeExploreScene.ts`، `globeTiles.ts`،
  `docs/astronomy-model.md`، `docs/architecture.md`، `docs/testing.md`،
  `docs/mission-014-p1.md`، `README.md`، `diagnostics/README.md`.
