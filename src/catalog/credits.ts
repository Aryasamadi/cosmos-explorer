import type { AssetCredit } from './types';

export const ASSET_CREDITS: AssetCredit[] = [
  {
    id: 'earth-texture',
    titleFa: 'بافت پایه و جزئیات زمین (Blue Marble Next Generation، ژوئیهٔ ۲۰۰۴)',
    author: 'NASA Earth Observatory / Reto Stöckli',
    license: 'Public domain (NASA)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    sourceUrl:
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x21600x10800.jpg',
    modificationsFa:
      'بافت پایه به ۲۰۴۸×۱۰۲۴ و کاشی‌های جزئیات تا ۱۶۳۸۴×۸۱۹۲ با فاصلهٔ حاشیهٔ ۸ پیکسل، تبدیل به WebP.',
  },
  {
    id: 'night-lights-texture',
    titleFa: 'چراغ‌های شب زمین (Black Marble 2016 در کانال آلفا)',
    author: 'NASA/GSFC، VIIRS روی Suomi NPP',
    license: 'Public domain (NASA)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    sourceUrl:
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg',
    modificationsFa:
      'پایهٔ ۱۰۲۴×۵۱۲؛ luminosity در کانال آلفای همان کاشی‌های جزئیات زمین (منبع ۱۳۵۰۰×۶۷۵۰) قرار گرفت تا تکسچر جداگانه لازم نباشد.',
  },
  {
    id: 'moon-texture',
    titleFa: 'بافت ماه (CGI Moon Kit / LROC color map)',
    author: 'NASA Scientific Visualization Studio / LRO',
    license: 'Public domain (NASA)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    sourceUrl: 'https://svs.gsfc.nasa.gov/4720',
    modificationsFa: 'تغییر اندازه به ۱۰۲۴×۵۱۲ و فشرده‌سازی JPEG.',
  },
  {
    id: 'mars-texture',
    titleFa: 'بافت مریخ (2k Mars)',
    author: 'Solar System Scope',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://www.solarsystemscope.com/textures/',
    modificationsFa: 'تغییر اندازه به ۱۰۲۴×۵۱۲ و فشرده‌سازی JPEG.',
  },
  {
    id: 'vazirmatn-font',
    titleFa: 'قلم وزیرمتن',
    author: 'The Vazirmatn Project Authors',
    license: 'SIL Open Font License 1.1',
    licenseUrl: 'https://openfontlicense.org/',
    sourceUrl: 'https://github.com/rastikerdar/vazirmatn',
    modificationsFa: 'استفاده به‌صورت فایل متغیر WOFF2 بدون تغییر.',
  },
  {
    id: 'openstreetmap-tiles',
    titleFa: 'کاشی‌های نقشهٔ OpenStreetMap',
    author: 'OpenStreetMap contributors',
    license: 'ODbL 1.0 و شرایط انتساب کاشی',
    licenseUrl: 'https://www.openstreetmap.org/copyright',
    sourceUrl: 'https://operations.osmfoundation.org/policies/tiles/',
    modificationsFa:
      'در زمان اجرا و فقط برای ناحیهٔ دیده‌شده از سرویس رسمی tile.openstreetmap.org دریافت می‌شوند؛ در مخزن ذخیره نمی‌شوند.',
  },
];
