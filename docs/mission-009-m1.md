# مأموریت ۰۰۹ — M1: UI Foundation & Accessibility

> این تغییرات فقط لایهٔ UI/دسترس‌پذیری را هدف گرفته‌اند. نمای اولیه، انتخاب Earth،
> دوربین، ناوبری، نورپردازی نجومی، GPS و سیستم نقشه تغییر نکرده‌اند. انتشار انجام
> نشده است.

## ۱. مبنا

- branch مبنا: `main` در commit `bb08d1c` (نسخهٔ منتشرشدهٔ Phase 1)
- branch کاری: `mission-009-m1-ui`
- working tree در شروع تمیز بود.
- comparison قبل/بعد روی سایت زنده و dev server محلی انجام شد؛ هیچ deploy جدیدی
  انجام نشد.

## ۲. تغییرات

- **Design tokens:** مقیاس تایپوگرافی (`12/13/14/16/20/22/24`)، رنگ‌های
  `--muted`/`--faint` با کنتراست بالاتر، سطح glass تیره‌تر و یک لایه blur.
- **Glass:** blur اصلی از ۱۸px به ۱۰px کاهش یافت؛ دکمه‌ها، pillها، HUDها،
  attribution و noticeها blur تودرتو ندارند. گزینه‌های
  `prefers-reduced-transparency` و `prefers-contrast` نیز اضافه شدند.
- **تایپوگرافی:** هیچ متن دیداری کمتر از ۱۲px نمانده است؛ متن اصلی پنل‌ها ۱۴px و
  عنوان‌های اصلی ۲۰–۲۴px است. CSS جدید در `src/styles/m1-foundation.css`.
- **هدف لمسی:** mode switch، settings، close، location، body/quick pills،
  hint close و اقدام‌های Sheet حداقل ۴۴×۴۴ شدند. دکمه‌های درون inline actions
  نیز از override عمومی ۴۴px استفاده می‌کنند.
- **Responsive shell:**
  - موبایل: هدر دو‌ردیفی با mode switch تمام‌عرض؛ Earth snapshot زیر هدر جا
    نمی‌ماند. در ۳۲۰px body pills به شبکهٔ ۲×۲ تبدیل می‌شوند.
  - تبلت/landscape: کنترل‌های بالایی و پایینی بازچینش شدند، بدون overlap.
  - دسکتاپ (≥1024): mode switch وسط هدر، body rail عمودی در لبهٔ stage،
    location dock پایین و info panel کنار صحنه؛ دیگر نسخهٔ کشیدهٔ موبایل نیست.
- **Sheet:** focus trap کامل با Tab/Shift+Tab، inert کردن همهٔ siblingهای خارج
  از مسیر dialog، Escape، ذخیره/بازگرداندن focus قبلی و جلوگیری از اسکرول
  background. واحد جدید `src/components/Sheet.test.tsx`.
- **Heading/landmark:** skip link، `main#main-content`، یک `h1` صفحه، heading
  سطح دوم Sky setup، `role=note` برای badge مقیاس و لندمارک‌های موجود حفظ شد.
- **کاهش متن:** caption تکراری پایین صحنه حذف شد؛ attribution OSM از دو نسخه به
  یک نسخه رسید؛ hint کوتاه شد؛ متن «دربارهٔ صحنه»، privacy و Sky setup فشرده شد.
- **E2E جدید:** `e2e/ui-foundation.spec.ts` سه تست برای شش viewport، هدف‌های ۴۴px،
  خوانایی labelها و focus trap/inert/restore اضافه می‌کند.

فایل‌های اصلی تغییرکرده: `src/styles/tokens.css`, `src/styles/base.css`,
`src/styles/m1-foundation.css`, `src/styles/index.css`, `src/app/App.tsx`,
`src/components/Sheet.tsx`, `src/features/free-explore/FreeExploreMode.tsx`,
`src/features/free-explore/EarthLocationSheet.tsx`,
`src/features/settings/SettingsDialog.tsx`,
`src/features/sky-view/ObserverSetup.tsx`، baselineهای visual و تست‌ها.

هیچ تغییر عمدی در `FreeExploreScene`, `solarSystem`, `referenceFrame`,
`locationService` یا tile provider انجام نشد.

## ۳. نتایج اندازه‌ها

E2E جدید در ۳۲۰×۵۶۸، ۳۹۰×۸۴۴، ۷۶۸×۱۰۲۴، ۸۴۴×۳۹۰، ۱۲۸۰×۸۰۰ و
۱۹۲۰×۱۰۸۰:

- overflow افقی: صفر
- overlap ناخواستهٔ header/action/scale/bottom: صفر
- همهٔ کنترل‌های اصلی ≥۴۴×۴۴
- همهٔ labelهای سنجیده‌شده ≥۱۲px
- تراکم متن: هیچ leaf text دیداری زیر ۱۲px در حالت free/sheets/Sky setup پیدا نشد
- focus trap/inert/بازگرداندن focus: سبز

## ۴. Screenshotهای قبل/بعد

- قبل، موبایل ۳۲۰/۳۹۰: `C:\tmp\m008-free-320.png`، `C:\tmp\m008-free-390.png`
- بعد، موبایل ۳۲۰/۳۹۰: `C:\tmp\m009-final-free-320.png`،
  `C:\tmp\m009-final-free-390.png`
- قبل، دسکتاپ ۱۲۸۰/۱۹۲۰: `C:\tmp\m008-free-1280.png`،
  `C:\tmp\m008-free-desktop1920.png`
- بعد، دسکتاپ ۱۲۸۰/۱۹۲۰: `C:\tmp\m009-final-free-1280.png`،
  `C:\tmp\m009-final-free-1920.png`
- بعد، landscape، Sheet و Sky: `C:\tmp\m009-final-free-landscape.png`،
  `C:\tmp\m009-final-settings-390.png`، `C:\tmp\m009-final-location-390.png`،
  `C:\tmp\m009-final-sky-setup-390.png`، `C:\tmp\m009-final-sky-390.png`
- baselineهای `diagnostics/baselines/win32/` نیز با UI جدید بازتولید شدند.

## ۵. تست‌ها

- `npm run test:ci`: **۱۸۲/۱۸۲ در ۳۱ فایل**
- `npm run typecheck`: سبز
- `npm run lint`: سبز
- `npm run build`: موفق
- `npx playwright test`: **۱۱/۱۱** (۸ E2E قبلی + ۳ E2E جدید M1)
- `diagnostics/navigation.spec.ts`: چهار expected-fail ناوبری همچنان fail واقعی و
  دست‌نخورده‌اند؛ یک تست cache pass.
- suite کامل diagnostics: **۴۰ تست، ۳۶ pass + ۴ expected-fail، ۰ unexpected،
  ۰ flaky، ۱۳٫۳ دقیقه**؛ baselineهای visual بازتولید و بازبینی شدند.
- audit نهایی در free/sheets/Sky: هیچ متن دیداری زیر ۱۲px و هیچ button زیر ۴۴px
  پیدا نشد؛ کنتراست توکن‌های اصلی `--muted`/`--faint` روی سطوح تیره ≥۶٫۸۵:۱ است.

## ۶. محدودیت‌های باقی‌مانده

- این مأموریت فقط UI است: دوربین هنوز keyboard-controllable نیست و نمای اولیه،
  state ناوبری و رفتار علمی تغییر نکرده‌اند (M2).
- focus trap برای Sheet است؛ info panel یک panel غیرمودال باقی می‌ماند.
- لینک‌های متنی inline (مجوز/منبع/OSM) طبق ماهیت لینک، ۴۴px نیستند؛ کنترل‌های
  اصلی و دکمه‌های بستن هستند.
- اثر glass روی header، sheet/info و control bar باقی مانده است؛ blur تودرتو
  حذف شده اما این سطوح برای خوانایی حفظ شده‌اند.
- screenshotها با Chrome headless/سخت‌افزار مجازی‌اند؛ ادعای FPS یا آزمون دستگاه
  فیزیکی نیست.
- baselineها platform-specific هستند و در CI لینوکسی باید جدا ساخته شوند.
- هیچ merge یا deploy انجام نشده است.

## ۷. Git

- branch: `mission-009-m1-ui`
- commit پیاده‌سازی: `2e60c83` — `feat(ui): add responsive accessible interface foundation`
- commit مستندات: همین commit
- push: فقط همین branch
- `main` و نسخهٔ منتشرشده بدون تغییر
