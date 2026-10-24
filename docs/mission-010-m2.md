# مأموریت ۰۱۰ — M2: ناوبری آزاد و حفظ وضعیت

> پایه: `mission-009-m1-ui` در commit `b854b0e` (M1). `main` همچنان `bb08d1c`
> است و M1/M2 merge یا deploy نشده‌اند. رفتار علمی، نورپردازی، LocationService،
> نقشه و بافت زمین تغییر نکرده‌اند.

## ۱. علت ریشه‌ای چهار نقص

| نقص | ریشهٔ واقعی | اصلاح |
| --- | --- | --- |
| انتخاب Earth در شروع | `initialAppState` مقدار `'earth'` داشت و Free mode همیشه `focusBody(selectedBodyId)` را اجرا می‌کرد | انتخاب free/sky به‌صورت nullable و جدا؛ شروع free با `null` و بدون focus |
| Earth → Moon → Earth نمای قبلی را از دست می‌داد | `focusBody('earth')` بی‌قید `resetOverview()` می‌کرد و هیچ pose قبلی ذخیره نمی‌شد | حافظهٔ pose برای هر body؛ بازگشت Earth نمای نزدیک ذخیره‌شده را برمی‌گرداند؛ Home عمداً overview را reset می‌کند |
| Free → Sky → Free انتخاب/زمینه را reset می‌کرد | `App.tsx` حالت غیرفعال را unmount می‌کرد و reducer در `set-mode` انتخاب را به fallback تغییر می‌داد | هر دو mode زنده می‌مانند و inactive فقط hidden/paused می‌شود؛ انتخاب مستقل هر mode حفظ می‌شود |
| camera pose در round-trip از بین می‌رفت | scene در mode switch dispose و دوباره ساخته می‌شد | یک scene پایدار، pause/resume بدون dispose، guard resize هنگام hidden و حفظ projection/camera |

## ۲. تغییرات کلیدی

- `AppState`:
  - `freeSelectedBodyId` و `skySelectedBodyId` جدا؛ هر دو در شروع `null`.
  - `set-mode` دیگر انتخاب را تغییر نمی‌دهد؛ فقط `infoOpen` را می‌بندد.
- `App.tsx`: هر دو mode همیشه mount هستند؛ mode غیرفعال با `hidden` حذف از UI
  و accessibility می‌شود.
- `FreeExploreScene` و `SkyScene`: `setActive()` برای pause/resume حلقهٔ رندر،
  جلوگیری از resize در حالت hidden و حفظ آخرین اندازه/pose.
- `FreeExploreMode` و `SkyMode`: prop فعال/غیرفعال، انتخاب nullable، رندر info
  فقط در mode فعال و Sky timer فقط در mode فعال.
- `FreeExploreScene`:
  - `enablePan`، `screenSpacePanning` و panSpeed برای mouse/touch.
  - حافظهٔ pose هر جرم (`savedViews`) و `focusedBodyId`.
  - `focusBody` برای Earth نمای قبلی را restore می‌کند؛ focus تکراری بدون reset.
  - `Home`/`0` نمای کلی، `1..4` انتخاب Earth/Moon/Sun/Mars.
  - میانبرهای جهت، Shift+جهت، `+/-` با جلوگیری از تداخل با input، slider و dialog.
- `SettingsDialog` و `docs/navigation.md`: مستندسازی mouse/touch/keyboard.
- `diagnostics/navigation.spec.ts`: چهار `test.fail` حذف و همان assertionهای واقعی
  به تست عادی تبدیل شد؛ دو تست جدید mouse/keyboard و touch.
- `captureCanvasSignature` و helper تست sharpness اکنون canvas mode فعال را
  انتخاب می‌کنند، چون architecture جدید دو canvas زنده دارد. این تغییر برای
  سازگاری با معماری است، نه ضعیف‌کردن assertion.

هیچ تغییری در `locationService`, `referenceFrame`, `solarSystem`,
`globeTiles`, `earthDetailLayer`، کاشی‌ها یا مدل نجومی انجام نشد.

## ۳. نتایج تست

- unit: **۱۸۳/۱۸۳ در ۳۱ فایل**
- E2E: **۱۱/۱۱** (آخرین اجرا پس از افزودن بخش میانبرها)
- typecheck: سبز
- lint: سبز
- build: موفق؛ build با `VITE_BASE_PATH=/cosmos-explorer/` و `check:pages` نیز
  موفق (۵ ارجاع محلی با base درست و دارایی‌های Earth detail موجود)
- diagnostics typecheck: سبز
- diagnostics مرورگری: **۴۲/۴۲** (۷ ناوبری، ۸ cache، ۱۵ geolocation، ۱ environment،
  ۱۱ visual)، **۰ expected-fail**
- visual: **۱۱/۱۱ مقایسه سبز**؛ ۱۲ baseline بازتولید و بازبینی شد.
- diagnostics نجومی: **۱۴/۱۴**
- چهار نقص ناوبری: **تبدیل به تست عادی و سبز با همان assertionهای قبلی**
- keyboard/touch: pixel signature تغییر معتبر می‌دهد؛ Home به نمای اولیه
  برمی‌گردد؛ Digit2 ماه را انتخاب می‌کند.
- فایل‌های اصلی: `src/app/appState.ts`, `src/app/appState.test.ts`,
  `src/app/App.tsx`, `src/engine/free/FreeExploreScene.ts`,
  `src/engine/sky/SkyScene.ts`, `src/features/free-explore/FreeExploreMode.tsx`,
  `src/features/sky-view/SkyMode.tsx`, `src/features/sky-view/SkyViewport.tsx`,
  `src/features/sky-view/SkyObjectsSheet.tsx`,
  `src/features/settings/SettingsDialog.tsx`, `src/styles/m1-foundation.css`,
  `diagnostics/navigation.spec.ts`, `diagnostics/helpers.ts`,
  `e2e/mobile.spec.ts`, baselineهای visual و `docs/navigation.md`.

## ۴. Screenshotها

- قبل M2 (M1، Earth انتخاب‌شده): `C:/tmp/m009-final-free-390.png`،
  `C:/tmp/m009-final-free-1280.png`
- بعد M2 (شروع آزاد بدون انتخاب): `C:/tmp/m010-after-initial-390.png`،
  `C:/tmp/m010-after-initial-1280.png`
- Earth close و انتخاب: `C:/tmp/m010-after-earth-close-390.png`،
  `C:/tmp/m010-after-earth-close-1280.png`
- Moon focus: `C:/tmp/m010-after-moon-390.png`
- بازگشت Earth (camera/map): `C:/tmp/m010-after-earth-restored-390.png`،
  `C:/tmp/m010-after-free-restored-390.png`
- Free → Sky → Free: `C:/tmp/m010-after-sky-390.png`،
  `C:/tmp/m010-after-free-restored-390.png`

## ۵. محدودیت‌ها

- ناوبری حول یک target orbit/pan است؛ 6DOF یا پرواز کاملاً آزاد نیست.
- حالت Free در حافظهٔ session حفظ می‌شود؛ reload صفحه وضعیت را بازیابی نمی‌کند.
- هر دو mode زنده می‌مانند؛ پس از وجود مکان مشترک ممکن است دو WebGL context
  داشته باشیم (Free + Sky). حلقهٔ hidden pause می‌شود، اما هزینهٔ حافظه باقی است.
- انتخاب هر mode جدا نگه داشته می‌شود؛ این یک تصمیم آگاهانه برای جلوگیری از
  از دست رفتن context است.
- mouse/keyboard با Playwright واقعی و touch با CDP شبیه‌سازی شده تست شده‌اند؛
  آزمون دستگاه فیزیکی انجام نشده است.
- screenshotها با Chrome headless/SwiftShader هستند.
- هیچ merge یا deploy انجام نشده است.

## ۶. Git

- شاخه: `mission-010-m2-navigation`
- مبنا: `b854b0e` (M1)
- commit پیاده‌سازی/تست: `61d5877` — `feat(navigation): preserve free exploration state and camera context`
- commit مستندات: همین commit
- push فقط روی همین شاخه
- `main` بدون تغییر (`bb08d1c`) و بدون merge/deploy
