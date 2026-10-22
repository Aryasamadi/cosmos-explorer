import type { AssetCredit } from './types';

export const ASSET_CREDITS: AssetCredit[] = [
  {
    id: 'earth-texture',
    titleFa: 'بافت زمین (Blue Marble Next Generation، ژوئیهٔ ۲۰۰۴)',
    author: 'NASA Earth Observatory / Reto Stöckli',
    license: 'Public domain (NASA)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    sourceUrl:
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x5400x2700.jpg',
    modificationsFa: 'تغییر اندازه به ۲۰۴۸×۱۰۲۴ و فشرده‌سازی JPEG برای کاهش حجم.',
  },
  {
    id: 'night-lights-texture',
    titleFa: 'چراغ‌های شب زمین (Black Marble 2012)',
    author: 'NASA Earth Observatory / Suomi NPP VIIRS',
    license: 'Public domain (NASA)',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    sourceUrl:
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg',
    modificationsFa: 'تغییر اندازه به ۱۰۲۴×۵۱۲ و فشرده‌سازی JPEG برای کاهش حجم.',
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
