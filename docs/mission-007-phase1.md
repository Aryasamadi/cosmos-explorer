# مأموریت ۰۰۷ — فاز ۱: frame علمی مشترک و LocationService

> این گزارش نتایج واقعی پیاده‌سازی فاز ۱ است. تغییرات فقط در branch
> `mission-007-phase1` نگه داشته شده‌اند؛ هیچ merge به `main` و هیچ deployment انجام
> نشده است.

## ۱. مبنا و شاخه

- branch مبنا: `mission-006-diagnostics` در commit `24dbb14`
- branch کاری: `mission-007-phase1`
- commit شروع: `24dbb14` (`docs: record phase-0 diagnostic results`)
- شاخهٔ مبنا ۲ commit از `main` (`ef249c4`) جلوتر و ۰ commit عقب‌تر بود؛ merge/rebase
  لازم نشد.
- working tree در شروع تمیز بود.

## ۲. فایل‌های تغییرکرده

### جدید

- `src/astronomy/simulationClock.ts` و تست
- `src/astronomy/referenceFrame.ts` و تست
- `src/engine/free/earthDisplayFrame.ts`
- `src/engine/free/litBodyMaterial.ts`
- `src/geo/locationService.ts` و تست
- `src/geo/locationAdapters.ts` و تست
- `docs/mission-007-phase1.md` (همین گزارش)
- `diagnostics/baselines/win32/moon-gibbous-390.png`

### تغییر‌یافته

- `src/engine/free/solarSystem.ts`
- `src/engine/free/FreeExploreScene.ts`
- `src/features/free-explore/FreeExploreMode.tsx`
- `src/features/free-explore/EarthLocationSheet.tsx` و تست آن
- `src/features/sky-view/SkyMode.tsx`
- `src/app/appState.ts` و تست آن
- `diagnostics/helpers.ts` (پشتیبانی از تاریخ UTC دلخواه)
- `diagnostics/astronomy.test.ts`
- `diagnostics/geolocation.spec.ts`
- `diagnostics/visual.spec.ts`
- ۱۲ baseline تصویری (۱۱ فایل قبلی بازتولید + یک فایل جدید)
- `README.md`، `docs/testing.md`، `docs/astronomy-model.md`،
  `diagnostics/README.md`، و یادداشت به‌روزرسانی در گزارش فاز ۰

هیچ dependency، asset جدید، UI redesign، تغییر OSM/TileStore، تغییر workflow یا
فایل `main` تغییر نکرد.

## ۳. مدل مختصات و محاسبهٔ جهت خورشید

### SimulationClock

- `SimulationClock` در `src/astronomy/simulationClock.ts` یک منبع زمان UTC مشترک
  برای صحنهٔ Earth و نمای Sky است.
- ساعت می‌تواند منبع زمان تزریقی یا زمان ثابت بگیرد؛ خروجی همیشه copy است.
- صحنه با throttle ۳۰ ثانیه‌ای موقعیت/نور را از ساعت می‌خواند.
- Sky در حالت live هر ثانیه از همان ساعت می‌خواند؛ حالت زمان ثابت UI همچنان برای
  زمان مشاهدهٔ آسمان جدا می‌ماند.

### frame

`computeReferenceFrame(date)` در `src/astronomy/referenceFrame.ts`:

1. `GeoVector` برای Sun/Moon/Mars در EQJ.
2. `Rotation_EQJ_EQD(date)` → استوای تاریخ.
3. `SiderealTime(date)` → ECEF و سپس frame محلی کره:
   `x = lon 0, y = north pole, z = lon 90W`.
4. `directionFromEarth` = جهت زمین‌مرکز هر جسم.
5. `sunDirection` = جهت واقعی خورشید در محل جسم:
   `body→Sun = SunGeo − BodyGeo` (تبدیل‌شده به فریم مشترک).
6. فاز هندسی: `(1 + dot(body→Sun, body→Earth))/2`.

نکتهٔ علمی مهم: استفاده از جهت خورشید دیده‌شده از Earth برای روشنایی Mars نادرست
است، چون مثلث Sun-Mars-Earth در مقیاس نمایشی حفظ نمی‌شود. برای همین هر جسم
`uSunDirection` مستقل و واقعی دارد. این تصمیم با اعداد `Illumination` تأیید شد.

### صحنه

- `earthDisplayFrame.ts` یک quaternion نمایشی ثابت (تیلت ۲۳٫۴۴° و spin ۲٫۱) دارد و
  همهٔ جهت‌ها با آن به world منتقل می‌شوند؛ بنابراین زاویه‌ها و فازها حفظ می‌شوند.
- فاصله‌های نمایشی: Sun=۳۴، Moon=۵٫۸، Mars=۱۸ (غیرمقیاسی).
- Earth shader جهت محلی خورشید (زیرخورشیدی) را می‌گیرد؛ موقعیت world خورشید نیز با
  همان جهت ساخته می‌شود.
- Moon/Mars از material سفارشی `litBodyMaterial` با نور Lambert و ambient کم
  استفاده می‌کنند؛ `DirectionalLight` ثابت حذف شده است.
- focus ماه/مریخ از سمت Earth انجام می‌شود تا فاز دیده‌شده با فاز ژئومرکزی مرجع
  مقایسه‌پذیر باشد.

## ۴. معیارهای علمی و نتایج عددی

آستانهٔ هم‌راستایی: اختلاف جهت خورشید صحنه با زیرخورشیدی Earth **کمتر از ۵°**.
آستانهٔ فاز: اختلاف مطلق **کمتر از ۰٫۱** و اختلاف نسبی **کمتر از ۱۰٪** برای فاز
مرجع ≥۰٫۱.

| تاریخ UTC | Sun scene vs subsolar | Moon rendered | Moon ref | Mars rendered | Mars ref |
|---|---:|---:|---:|---:|---:|
| 2026-01-15T00:00Z | ۰٫۰۰۵۸° | 0.134889 | 0.134889 | 0.999898 | 0.999899 |
| 2026-03-20T12:00Z | ۰٫۰۰۵۶° | 0.028117 | 0.028117 | 0.990246 | 0.990252 |
| 2026-06-21T12:00Z | ۰٫۰۰۵۷° | 0.458314 | 0.458314 | 0.955803 | 0.955813 |
| 2026-09-23T00:00Z | ۰٫۰۰۵۶° | 0.858252 | 0.858252 | 0.908110 | 0.908118 |
| 2026-12-21T12:00Z | ۰٫۰۰۵۹° | 0.902979 | 0.902979 | 0.914870 | 0.914866 |

- حداکثر خطای فاز ماه: **< 0.000001** (عملاً صفر در دقت گزارش).
- حداکثر خطای فاز مریخ: **0.000011**.
- حداکثر خطای نسبی فاز: **0.000011** (۰٫۰۰۱۱٪)، بسیار کمتر از ۱۰٪.
- حداکثر اختلاف Sun با `computeSubsolarPoint` مستقل: **۰٫۰۰۵۹°**.
- تست‌ها درستی این نتیجه را با ثابت‌های قدیمی تأیید می‌کنند: مدل قبلی برای
  همان تاریخ ۲۱ ژوئن، خطای Sun ≈۱۵۶٫۹° و خطای فاز Mars ≈۰٫۸۶ داشت.

> تعریف فاز یکسان است: کسر قرص روشن از دید مرکز زمین با `Illumination` همان
> کتابخانه، و جهت نور در محل جسم. برای ماه و مریخ از یک مدل زمانی مشترک استفاده
> شده است.

## ۵. نتایج تصویری

baselineها در `diagnostics/baselines/win32/`:

- `initial-320.png`، `initial-390.png`، `initial-768.png`، `initial-1280.png`
- `earth-day-390.png` (Cairo، تاریخ ثابت، روشن)
- `earth-night-390.png` (Honolulu، تاریخ ثابت، شب)
- `moon-390.png` (Moon در 2026-06-21؛ فاز مرجع 0.458)
- `moon-gibbous-390.png` (Moon در 2026-09-23؛ فاز مرجع 0.858)
- `mars-390.png` (Mars در 2026-06-21؛ فاز مرجع 0.956)
- `tile-loading-390.png`، `tile-error-390.png`
- `location-sheet-390.png`

بررسی چشمی و تحلیل luminance مرکزی (پیکسل‌های روشن‌تر از luma 60 داخل قرص):

- Moon در 2026-06-21: حدود **۰٫۳۱** از قرص.
- Moon در 2026-09-23: حدود **۰٫۶۶** از قرص.
- Mars: نمای تقریباً کامل، سازگار با فاز ۰٫۹۵۶.

Earth day/night پس از هم‌راستایی نیز همان تفکیک روشن/تاریک مورد انتظار را نشان
می‌دهد. baselineها فقط win32/SwiftShader/DPR1 هستند و مرجع رنگ یا GPU موبایل نیستند.

## ۶. نتایج LocationService

سناریوهای اجراشده (همه با geolocation شبیه‌سازی‌شده):

- granted: fix وارد state مشترک و marker زمین می‌شود.
- denied: پیام صریح، بدون fallback خودکار، مختصات دستی در دسترس.
- timeout: دقیقاً یک fallback کم‌دقت و پیام نهایی.
- unavailable: پیام صریح و بدون ساخت موقعیت.
- unsupported: پیام صریح و ورود دستی.
- insecure (Earth و Sky): پیش از فراخوانی API رد می‌شود؛ پیام HTTPS.
- permission از قبل denied: geolocation اصلاً فراخوانی نمی‌شود (counts = ۰).
- coarse fallback: fix با accuracy ۹۰۰ متر ثبت می‌شود، accuracy/منبع نمایش داده
  می‌شود، برگه باز می‌ماند و زوم خودکار رخ نمی‌دهد.
- manual: در Earth و Sky کار می‌کند و بین دو حالت مشترک است.
- Earth→Sky و Sky→Earth: مکان مشترک در session دیده می‌شود.
- storage: هیچ مختصاتی در localStorage/sessionStorage نوشته نمی‌شود.

## ۷. تست‌ها و نتایج

| کنترل | نتیجه |
| --- | --- |
| `npm run test:ci` | **۱۸۱ تست در ۳۰ فایل**، همه سبز |
| `npm run typecheck` | سبز |
| `npm run test:diagnostics:typecheck` | سبز |
| `npm run lint` | بدون خطا/هشدار |
| `npm run build` | موفق؛ JS gzip ≈۲۷۹KB، CSS gzip ≈۷٫۴KB |
| `npx playwright test` (تولیدی) | **۸/۸ سبز** |
| `npm run test:diagnostics:astronomy` | **۱۴/۱۴ سبز** |
| `npm run test:diagnostics:browser` | **۴۰ تست: ۳۶ pass + ۴ expected-fail، ۰ unexpected/flaky، ۱۷٫۵ دقیقه** |
| چهار تست navigation | همان ۴ نقص خارج از محدوده، آگاهانه expected-fail |

## ۸. محدودیت‌های باقی‌مانده

- فاصله‌های صحنه غیرمقیاسی‌اند؛ جهت و فاز علمی است، اما اندازه/فاصله نمایشی نیست.
- چرخش ظاهری Earth ثابت است و مدل IAU نیست؛ ترمنیتور و نورپردازی فیزیکی است.
- موقعیت‌های صحنه ژئومرکزی‌اند؛ پارالاکس توپوسنتریک در نمای آزاد اعمال نمی‌شود.
- سطح ماه/مریخ با ambient کم روشن می‌شود؛ فاز هندسی درست است، اما رادیانس فیزیکی
  یا مدل جوّ ادعا نمی‌شود.
- focus ماه/مریخ فاز را از سمت Earth نشان می‌دهد، اما دوربین در فاصلهٔ محدود از جسم
  است؛ این تقریب در حد چند صدم درصد با دید مرکز زمین تفاوت دارد.
- چهار نقص ناوبری (selectedBodyId اولیه، بازگشت focus/pose و state بین حالت‌ها)
  عمداً خارج از محدودهٔ فاز ۱ ماندند و همچنان `test.fail` هستند. در دو تست از این
  چهار، فقط مرحلهٔ ورود به Sky با رفتار جدید «مکان مشترک» هماهنگ شد (HUD به‌جای
  صفحهٔ setup)؛ assertion نقص و `test.fail` تغییر نکرد.
- هیچ آزمون GPS/دستگاه فیزیکی، iOS/Android، GPU موبایل یا OSM واقعی انجام نشد.
- baselineها platform-specific هستند و در Linux/CI باید جدا ساخته شوند.
- هیچ merge/deploy انجام نشده است.

## ۹. Git و انتشار

- branch: `mission-007-phase1`
- commit پیاده‌سازی: `895ec1f` — `feat: align celestial lighting and share location state`
- commit مستندات/گزارش: همین commit روی شاخه (بعد از `895ec1f`)
- push: فقط `mission-007-phase1`؛ `main` بدون تغییر است.
- push فقط روی همین branch؛ merge به `main` و deploy انجام نشده است.
- چهار تست navigation خارج از محدوده با همان `test.fail` باقی ماندند؛ فقط setup دو
  تست با HUD مشترک Sky هماهنگ شد.

نتیجهٔ نهایی diagnostics browser: **۴۰ تست، ۳۶ pass + ۴ expected-fail، ۰ unexpected، ۰ flaky**؛ astronomy: **۱۴/۱۴ pass**.
