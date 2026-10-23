> **به‌روزرسانی فاز ۱ (۲۰۲۶-۱۰-۲۳):** نقص‌های astronomy (Sun/Moon/Mars) و
> geolocation (Earth/Sky) این گزارش با frame علمی مشترک و LocationService مشترک
> برطرف شدند. چهار نقص ناوبری باقی مانده است. نتایج جدید در
> [گزارش فاز ۱](mission-007-phase1.md) آمده است. این سند سابقهٔ فاز ۰ است.

# مأموریت ۰۰۶ — گزارش تشخیصی فاز ۰

> این گزارش وضعیت واقعی نسخهٔ ۰٫۴٫۰ را ثبت می‌کند. diagnostic suite عمداً از
> `npm run test:e2e` و CI معمول جدا است؛ موفقیت CI فعلی به معنی اجرای این تست‌ها
> نیست. هیچ کد production، dependency، asset، UI یا تنظیمات build تغییر نکرد.

## ۱. وضعیت پایه و محیط

- مخزن: `C:\Users\Mustafa\Projects\cosmos-explorer`
- شاخه: `main`
- commit شروع بررسی: `ef249c4b6a80e77c701923036b2df0bb083d7c38`
- working tree در شروع: تمیز.
- Runtime: Node `v24.18.1`، npm `11.16.0`
- تست: Playwright `1.64.1`، Vitest `5.0.5`
- مرورگر: Chrome `156.0.8078.48`
- سیستم: Windows 10 Pro، Intel Core i5-6200U، Intel HD Graphics 520
- WebGL در diagnostic suite: **SwiftShader** (بدون ادعای GPU موبایل)
- baseline تصویری: DPR=1، SwiftShader، locale=`fa-IR`، ساعت ثابت
  `2026-06-21T12:00:00Z`
- Network: همهٔ درخواست‌های OSM در تست‌ها mock/abort شدند؛ هیچ درخواست واقعی OSM
  ارسال نشد.
- Geolocation: همهٔ سناریوها شبیه‌سازی‌شده‌اند؛ هیچ آزمون GPS/دستگاه فیزیکی انجام
  نشد.

## ۲. دستورهای اجراشده و نتایج

| دستور | نتیجه |
| --- | --- |
| `npm run test:ci -- --reporter=dot` | **۱۵۹ تست در ۲۶ فایل سبز**؛ ۲۳٫۶۵ ثانیه |
| `npx playwright test` (suite تولیدی) | **۸ تست سبز**؛ حدود ۴٫۷ دقیقه |
| `npm run build` | موفق؛ JS gzip ≈۲۸۰KB، CSS gzip ≈۷٫۴KB |
| `npm run test:diagnostics:typecheck` | موفق |
| `npx eslint diagnostics ...` | موفق |
| `npm run test:diagnostics:astronomy` | ۳ pass + ۳ expected-fail شناخته‌شده |
| `npm run test:diagnostics:browser` | **۳۵ تست سبز (۰ unexpected) در ۳۰٫۷ دقیقه**؛ شامل ۶ known-defect علامت‌خورده |
| `npx playwright test --config ... visual.spec.ts` | ۱۰ تست / ۱۱ baseline؛ یک اجرای update و دو اجرای مقایسهٔ سبز |

`npm run build` در همین بررسی اجرا شد؛ حجم assetها و JS همان مقادیر ثبت‌شده در
مستندات ۰٫۴٫۰ است. build موفق فقط سلامت bundle را نشان می‌دهد، نه کیفیت بصری.

## ۳. تست‌های موفق و شکست‌خورده

### موفق و سبز

- تمام ۱۵۹ تست واحد/UI قبلی دوباره اجرا و سبز شدند.
- تمام ۸ تست تولیدی Playwright دوباره اجرا و سبز شدند.
- diagnosticهای cache: درخواست‌های bounded و unique، cache hit پس از بازگشت و
  reload، Cache Storage پس از restart مرورگر، خطاهای HTTP 404/429، لغو درخواست
  هنگام خروج، trim سقف ۱۲۰، و نبود traffic در startup.
- diagnosticهای geolocation شبیه‌سازی‌شده: granted، denied، timeout، unavailable،
  unsupported، insecure برای مسیر Earth، fallback کم‌دقت، manual fallback، عدم
  ذخیرهٔ مختصات در localStorage/sessionStorage.
- astronomical reference پایه: نقطهٔ زیرخورشیدی ثابت، تفکیک روز/شب Cairo و
  Honolulu، round-trip مختصات، آستانه‌های day/city-light.
- visual baselineهای ۱۱گانه پس از بازتولید با config نهایی، در یک اجرای کامل
  بدون update سبز شدند.
- جمع‌بندی: ۳۵ تست browser diagnostic سبز (۱۹ pass عادی + ۱۰ visual + ۶
  known-defect) و ۰ تست unexpected/flaky/skipped. سه تست astronomy نیز pass و سه
  known-defect جداگانه دارند.

### expected-failهای شناخته‌شده

این تست‌ها با `it.fails`/`test.fail` علامت خورده‌اند تا شکست پنهان نشود. اگر رفتار
production بعداً اصلاح شود، فلگ Playwright/Vitest «unexpectedly passed» می‌دهد و
باید آگاهانه به تست موفق تبدیل شوند.

| تست | علت واقعی شکست فعلی |
| --- | --- |
| scene-Sun با subsolar واقعی | اختلاف حدود ۱۵۶٫۹° در تاریخ ثابت؛ Earth با وضعیت ثابت و Sun صحنه هم‌راستا نیست |
| فاز Moon در برابر ephemeris | کسر روشن مبتنی بر light صحنه ≈۰٫۰۲۳ در برابر مقدار واقعی ≈۰٫۴۵۸ |
| فاز Mars در برابر ephemeris | کسر روشن صحنه ≈۰٫۴۰۷ در برابر مقدار واقعی ≈۰٫۹۵۶ |
| نمای اولیه بدون Earth | `initialAppState` همچنان `selectedBodyId='earth'` دارد و یک body pill انتخاب‌شده وجود دارد |
| Earth → Moon → Earth | بازگشت به Earth به overview می‌رود؛ `.earth-map-status` فعال قبلی برنمی‌گردد |
| Free → Sky → Free | پس از بازگشت، body انتخاب‌شده `خورشید` است و map status وجود ندارد |
| حفظ camera pose | اختلاف امضای ۲۴×۲۴ luminance پیش/پس از roundtrip ≈۶۶٫۷ (آستانهٔ ۵) |
| اشتراک مکان Earth/Sky | Sky HUD پس از انتخاب مکان در Earth ظاهر نمی‌شود؛ state مکان Sky جداست |
| secure-context در Sky | Sky پیام HTTPS نمی‌دهد و geolocation را صدا می‌زند؛ در تست، خطای timeout/permission دیده شد |

## ۴. مشکلات واقعی بازتولیدشده

1. **انتخاب اجباری Earth در شروع:** بازکردن برنامه، body pill زمین را pressed نشان
   می‌دهد؛ نمای آزاد بدون انتخاب وجود ندارد.
2. **از دست رفتن زمینهٔ ناوبری:** با Earth→Moon→Earth نقشهٔ فعال قبلی پس از بازگشت
   حاضر نیست. با Free→Sky→Free، state به خورشید تغییر می‌کند و دوربین به سمت آن
   می‌رود؛ مختصات تهران در HUD باقی می‌ماند ولی نمای زمین بازنمی‌گردد.
3. **فقدان camera pose پایدار:** امضای canvas قبل/بعد از roundtrip تفاوت بسیار زیاد
   دارد؛ scene و دوربین از نو ساخته می‌شوند.
4. **ناهم‌راستایی نور Earth با صحنه:** subsolar واقعی با جهت Sun صحنه هم‌راستا
   نیست. این یافته با محاسبهٔ مستقل از ثابت‌های فعلی `solarSystem.ts` بازتولید شد؛
   production API برای خواندن uniform در زمان اجرا وجود ندارد. آزمون Tehran نشان
   داد شیدر در نقطهٔ روزانه به‌درستی روشن است؛ مشکل frame است، نه معکوس‌شدن فرمول
   روز/شب.
5. **فاز غیرواقعی Moon/Mars:** نور DirectionalLight ثابت صحنه برای هر دو استفاده
   می‌شود؛ فاز حاصل با `Illumination` واقعی فاصلهٔ زیاد دارد. این آزمون روی
   پیکربندی/مدل نور است، نه اندازه‌گیری فاز از تصویر رندرشده.
6. **دو مسیر مکان مستقل:** Earth از `acquireDeviceLocation` با fallback مرحله‌ای و
   Sky از `navigator.geolocation` مستقیم با timeout متفاوت استفاده می‌کند. Earth و
   Sky مکان را به اشتراک نمی‌گذارند و Sky بررسی secure context ندارد.
7. **Cache Storage درست ولی تجربهٔ بازگشت کند:** در تست mock، بازگشت/reload/restart
   هیچ network جدیدی ایجاد نکرد و entries باقی ماندند؛ اما textureها هنگام خروج
   dispose می‌شوند و decode/upload دوباره انجام می‌شود. در این محیط SwiftShader،
   زمان آماده‌شدن قابل اتکا نیست و به‌عنوان benchmark گزارش نمی‌شود.
8. **UI قابل‌اندازه‌گیری:** baselineها نوار وضعیت ۸px، انتساب OSM تکراری/همیشگی و
   متن‌های کم‌رنگ را نشان می‌دهند. baselineها فقط رفتار فعلی را ثبت می‌کنند، نه
   طراحی هدف.

## ۵. Baselineهای تصویری

مسیر: `diagnostics/baselines/win32/`

| فایل | وضعیت |
| --- | --- |
| `initial-320.png` | نمای اولیه، ۳۲۰×۵۶۸، DPR=1 |
| `initial-390.png` | نمای اولیه، ۳۹۰×۸۴۴ |
| `initial-768.png` | نمای اولیه، ۷۶۸×۱۰۲۴ |
| `initial-1280.png` | نمای اولیه، ۱۲۸۰×۸۰۰، desktop |
| `earth-day-390.png` | Cairo در تاریخ ثابت، روشن |
| `earth-night-390.png` | Honolulu در تاریخ ثابت، شب |
| `moon-390.png` | نمای focus ماه در وضعیت فعلی |
| `mars-390.png` | نمای focus مریخ در وضعیت فعلی |
| `tile-loading-390.png` | Cairo با کاشی‌های OSM mock معلق |
| `tile-error-390.png` | همان نما پس از abort کاشی‌ها |
| `location-sheet-390.png` | برگهٔ «موقعیت من» بدون درخواست مجوز |

- Earth day/night با ساعت ثابت `2026-06-21T12:00:00Z` و OSM مسدود تولید شد.
- baselineها با config نهایی (موبایل ۳۹۰×۸۴۴، `fa-IR`، `Asia/Tehran`، DPR=1)
  با `--update-snapshots` بازتولید و سپس در اجرای کامل بدون update مقایسه شدند.
- baselineهای بارگذاری/خطای کاشی در یک تست و از یک session گرفته می‌شوند؛
  `tile-error-390.png` پس از abort کاشی‌ها ثبت شده است.
- این baselineها مرجع GPU موبایل یا رنگ دقیق نیستند؛ برای تغییر platform باید
  baseline همان platform ساخته شود.

## ۶. شکاف‌هایی که به تغییر production نیاز دارند

- **Scene probe:** camera pose، frame فعال، uniform خورشید و فاز واقعیِ هر body در
  production قابل خواندن نیست؛ آزمون‌ها ناچارند ثابت‌های `solarSystem.ts` را تکرار
  کنند یا از UI/pixel proxy استفاده کنند.
- **State persistence:** هیچ store پایدار یا state stack برای camera/focus/body وجود
  ندارد؛ mode switch کل scene را unmount می‌کند.
- **Shared location:** state مکان Earth و Sky مشترک نیست؛ Sky مسیر geolocation جدا
  دارد و secure-context/permission diagnostics کامل ندارد.
- **Resource cache:** texture cache فقط تا `clear()` زنده است؛ cache پایدار OSM
  bytes را نگه می‌دارد، ولی decoded texture/GPU cache بازیابی فوری ندارد.
- **Observability/CI:** diagnostic suite فعلاً gate CI نیست؛ baselineها
  platform-specific هستند و GPS/device واقعی در CI وجود ندارد.
- **Sci-visual frame:** یک reference-frame مشترک برای خورشید، Earth، Moon و Mars
  وجود ندارد؛ رفع آن یک تغییر production است.

## ۷. محدودیت‌های آزمون

- **WebGL:** همهٔ diagnosticها با SwiftShader اجرا شدند. FPS، مصرف حافظه، دقت
  فیلتر و رنگ GPU موبایل اندازه‌گیری نشد.
- **Network:** OSM واقعی آزمایش نشد؛ tile fixture محلی صرفاً قرارداد نرم‌افزار را
  می‌سنجد. سیاست OSM، latency واقعی، 429 واقعی و CDN بررسی نشد.
- **Geolocation:** همهٔ سناریوها injection/Playwright هستند؛ GPS، OS Location
  Services، permission prompt واقعی iOS/Android و دقت مکان بررسی نشدند.
- **Physical device:** هیچ آزمون فیزیکی انجام نشد.
- **Visual:** baselineهای فعلی فقط win32/SwiftShader/DPR1 هستند؛ در Linux/CI باید
  جداگانه تولید شوند. baseline، «طراحی درست» نیست؛ فقط snapshot وضعیت فعلی است.
- **Timing:** زمان‌های آماده‌شدن در SwiftShader به‌شدت محیط‌وابسته‌اند و معیار
  performance موبایل نیستند. decode/upload جدا از network در production
  instrument نشده‌اند.

## ۸. معیارهای پذیرش پیشنهادی برای فازهای بعدی

### Phase 1 — Scientific frame / location foundation

- Earth، Moon و Mars در یک `SimulationClock` و `ReferenceFrame` مشترک محاسبه شوند.
- در تاریخ ثابت، جهت Sun صحنه با subsolar واقعی Earth کمتر از ۵° اختلاف داشته باشد.
- فاز Moon/Mars از `Illumination` واقعی کمتر از ۱۰٪ اختلاف داشته باشد.
- یک LocationService مشترک برای Earth/Sky؛ secure context و permission state قبل
  از درخواست بررسی شود؛ Earth/Sky sync تست شود.
- تست‌های expected-fail مربوط به این موارد باید به pass معمولی تبدیل شوند.

### Phase 2 — Navigation / renderer lifecycle

- initial view بدون انتخاب اجباری Earth.
- Earth→Moon→Earth و Free→Sky→Free بدون از دست‌دادن body/focus/camera pose.
- تفاوت امضای pose پس از roundtrip زیر آستانهٔ موردتوافق (مثلاً ۵) باشد.
- بازگشت به نمای قبلی حداقل یک مسیر صریح و قابل‌کشف داشته باشد.

### Phase 3 — Cache / progressive detail

- بازگشت به ناحیهٔ دیده‌شده بدون network و بدون decode دوباره، در صورت وجود
  decoded cache.
- سقف‌های GPU/JS/Cache Storage قابل‌مشاهده و قابل‌تست باشند؛ eviction بر اساس
  آخرین استفاده باشد.
- OSM policy، attribution، عدم prefetch و محدودیت viewport حفظ شود.
- تست واقعی یا controlled provider برای 404/429/cancel و restart حفظ شود.

### Phase 4 — Visual/UI

- baselineهای platform-specific در CI با threshold مصوب.
- contrast ≥4.5:1 برای متن عملیاتی، اهداف لمسی ≥44px، focus trap و reduced motion.
- UIهای loading/error/location/object focus در viewportهای ۳۲۰–۱۲۸۰ بدون
  overflow و با خوانایی قابل‌بررسی.
- تست فیزیکی Android/iOS و GPU واقعی، جدا از headless.

## ۹. فایل‌های تغییرکرده و دلیل

- `diagnostics/` — harness و تست‌های Phase 0 (ناوبری، نجوم، cache، geolocation،
  environment، visual). هیچ فایل production در آن نیست.
- `playwright.diagnostics.config.ts` — config جدا، mobile baseline و اجرای
  SwiftShader.
- `vitest.diagnostics.config.ts` — تست‌های علمی خالص خارج از gate تولید.
- `tsconfig.diagnostics.json` — typecheck هارنس بدون تغییر build تولید.
- `package.json` — فقط پنج script تشخیصی؛ dependency جدیدی اضافه نشد.
- `diagnostics/baselines/win32/*.png` — ۱۱ baseline تصویری current-state.
- `docs/mission-006-diagnostics.md` — همین گزارش.
- `diagnostics/README.md` — راهنمای اجرا و مرزها.
- `docs/testing.md` و `README.md` — ارجاع به suite تشخیصی و شفاف‌سازی اینکه CI
  معمول آن را اجرا نمی‌کند.

## ۱۰. Git و انتشار

- شاخهٔ کاری: `mission-006-diagnostics` (از `main` در commit `ef249c4`)
- commit هارنس/تست‌ها/baselineها: `e9603f9` — `test: add cosmos diagnostic baselines`
- commit این گزارش: در commit مستندات همین شاخه ثبت می‌شود.
- push فقط روی همین شاخه انجام می‌شود؛ چون workflowهای `CI` و `Deploy` فقط روی
  `main` trigger می‌شوند، هیچ deployment در این مأموریت انجام نشد.
- هیچ فایل production، dependency، asset، UI یا build config تغییر نکرده است.
