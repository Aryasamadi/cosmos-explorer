# ADR 0004 — مرز مهندسی Three.js و React

- وضعیت: پذیرفته‌شده
- تاریخ: ۲۰۲۶-۱۰-۲۲

## زمینه

رندر سه‌بعدی state و lifecycle خاص خود را دارد. اگر این جزئیات داخل کامپوننت‌های React
پخش شوند، هر تغییر state می‌تواند باعث ساخت renderer تکراری، نشت GPU یا حلقهٔ رندر
غیرضروری شود.

## تصمیم

- `FreeExploreScene` و `SkyScene` کلاس‌های imperative هستند و مالک renderer، دوربین،
  loop، listenerها و cleanup.
- کامپوننت‌های React فقط از طریق ref/متدهای محدود (`focusBody`, `setAttitude`,
  `updateSnapshot`, `dispose`, ...) با آن‌ها صحبت می‌کنند.
- ساخت صحنه در ref callback مربوط به container انجام می‌شود و تابع cleanup برگردانده
  می‌شود؛ این کار با React 19 سازگار است و از setState همگام در effect عادی جلوگیری
  می‌کند.
- دادهٔ پرنرخ حسگر مستقیماً به متد `setAttitude` می‌رود و React را در هر رویداد رندر
  نمی‌کند.
- snapshot علمی حداکثر یک بار در ثانیه به صحنه داده می‌شود.
- یک `RenderLoop` مشترک، loop را هنگام hidden متوقف می‌کند.

## پیامدها

- تست UI بدون WebGL ممکن است و مسیر fallback نیز پوشش داده می‌شود.
- مسئولیت cleanup صریح است: هیچ texture/geometry/renderer بدون dispose رها نمی‌شود.
- منطق دامنه‌ای جدید باید در ماژول‌های علمی/سنسوری باشد، نه داخل کلاس صحنه.
- پیچیدگی ref callback برای توسعه‌دهنده کمی بیشتر است، اما lifecycle شفاف‌تر می‌شود.
