# منابع، مجوز دارایی‌ها و انتساب

## کد

کد این مخزن با مجوز [MIT](../LICENSE) ارائه می‌شود. مجوز دارایی‌های تصویری و قلم
مستقل است و در ادامه ذکر شده است.

## دارایی‌های تصویری

| دارایی | منبع | مجوز | تغییرات |
| --- | --- | --- | --- |
| `src/assets/textures/earth.jpg` | [NASA Earth Observatory — Blue Marble Next Generation, July 2004](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x5400x2700.jpg) | NASA media، عمومی با ذکر منبع | تغییر اندازه به ۲۰۴۸×۱۰۲۴ و فشرده‌سازی JPEG |
| `src/assets/textures/night-lights.jpg` | [NASA Earth Observatory — Black Marble 2012 (Suomi NPP VIIRS)](https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg) | NASA media، عمومی با ذکر منبع | تغییر اندازه به ۱۰۲۴×۵۱۲ و فشرده‌سازی JPEG |
| `src/assets/textures/moon.jpg` | [NASA Scientific Visualization Studio — CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) | NASA media، عمومی با ذکر منبع | تغییر اندازه به ۱۰۲۴×۵۱۲ و فشرده‌سازی JPEG |
| `src/assets/textures/mars.jpg` | [Solar System Scope — 2k Mars](https://www.solarsystemscope.com/textures/) | CC BY 4.0 | تغییر اندازه به ۱۰۲۴×۵۱۲ و فشرده‌سازی JPEG |

### انتساب CC BY 4.0 برای بافت مریخ

بافت مریخ از Solar System Scope تهیه شده، تغییر اندازه داده و به JPEG فشرده شده است.
مجوز: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
این پروژه به Solar System Scope وابسته نیست و تأییدیه‌ای از آن ندارد.

## کاشی‌های نقشهٔ زمان اجرا

- منبع: **OpenStreetMap Standard raster tiles**
- URL: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- انتساب اجباری و نمایش‌داده‌شده: **© OpenStreetMap contributors**
- مجوز داده: [Open Database License (ODbL)](https://www.openstreetmap.org/copyright)
- سیاست رسمی استفاده: <https://operations.osmfoundation.org/policies/tiles/>
- بررسی‌شده در: ۲۰۲۶-۱۰-۲۲

شرایط کلیدی: بدون کلید API؛ فقط نمایش تعاملی ناحیهٔ دیده‌شده؛ ممنوعیت bulk download،
prefetch چندسطحی، آفلاین‌سازی و ربات‌هایی که برای رندر pan/zoom می‌کنند؛ انتساب آشکار؛
ارسال Referer معتبر توسط مرورگر؛ کش حداقل هفت‌روزه. این سرویس **best-effort** است و
SLA یا ظرفیت تضمین‌شده ندارد. کاشی‌ها کارتوگرافی هستند، نه تصویر ماهواره‌ای.

در این پروژه:

- انتساب در گوشهٔ نمای زمین هنگام فعال‌بودن جزئیات و در برگهٔ مکان دیده می‌شود.
- Cache Storage با TTL هفت‌روزه و سقف ۱۲۰ ورودی استفاده می‌شود؛ هیچ prefetch یا
  دانلود آفلاین انجام نمی‌شود.
- درخواست کاشی فقط برای شبکهٔ حداکثر ۳×۳ اطراف ناحیهٔ دیده‌شده و پس از توقف دوربین
  انجام می‌شود.
- تست‌های خودکار Playwright درخواست‌های OSM را مسدود می‌کنند.
- هیچ کلید، توکن یا اعتبارنامه‌ای برای این سرویس لازم یا ذخیره نمی‌شود.
- این پروژه به OpenStreetMap Foundation وابسته نیست و تأییدیه‌ای از آن ندارد.

## قلم

- **Vazirmatn** (وزیرمتن) — The Vazirmatn Project Authors
- مجوز: [SIL Open Font License 1.1](https://openfontlicense.org/)
- منبع: <https://github.com/rastikerdar/vazirmatn>
- فایل متغیر WOFF2 بدون تغییر استفاده شده است. متن مجوز در
  `src/assets/fonts/OFL.txt` قرار دارد.

## داده‌های علمی

| منبع | استفاده |
| --- | --- |
| [NASA NSSDCA — Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) | شعاع، جرم، فاصله، دوره، دما و انحراف محور زمین |
| [NASA NSSDCA — Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) | مشخصات ماه |
| [NASA NSSDCA — Sun Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html) | مشخصات خورشید |
| [NASA NSSDCA — Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | مشخصات مریخ |
| [SIMBAD Astronomical Database](https://simbad.cds.unistra.fr/simbad/) | مختصات J2000، قدر ظاهری و ردهٔ طیفی ستارگان |
| [Astronomy Engine](https://github.com/cosinekitty/astronomy) | ephemeris، سیدرال تایم، پیش‌روی، روشنایی؛ مجوز MIT |
| [NASA Earth Observatory — Black Marble](https://earthobservatory.nasa.gov/features/NightLights) | چراغ‌های شب زمین برای سمت شب صحنه؛ دادهٔ ثابت ۲۰۱۲ |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | کاشی‌های کارتوگرافی زمان اجرا برای نمای محلی زمین؛ ODbL |

داده‌های NASA مطابق رویهٔ عمومی استفاده از رسانه‌های NASA با ذکر منبع استفاده شده‌اند.
استفاده از نام NASA به معنی تأیید این پروژه توسط NASA نیست.

## دادهٔ مرجع تست

- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) — نمونه‌های آزیموت/ارتفاع/برد
  برای تست‌های خودکار، با تنظیمات مستند در `docs/testing.md`.
- استفاده از Horizons فقط در زمان توسعه/تست است؛ در runtime هیچ درخواستی به آن ارسال
  نمی‌شود.

## ستارگان

کاتالوگ شامل ۱۲ ستارهٔ درخشان است و ادعای کامل بودن ندارد. مختصات با دقت نمایشی و
بر پایهٔ J2000 ثبت شده‌اند؛ حرکت خاص و پارالاکس سالانه در نمایش اعمال نمی‌شوند.
مقادیر فاصله تقریبی و دارای عدم قطعیت‌اند.

## نام‌ها و نشان‌ها

نام‌های NASA، JPL، SIMBAD، Astronomy Engine، Solar System Scope و OpenStreetMap
متعلق به صاحبان مربوط است. این پروژه یک پروژهٔ مستقل است.
