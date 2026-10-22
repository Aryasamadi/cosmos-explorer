import { ASSET_CREDITS } from '../../catalog/credits';
import { DATA_SOURCES } from '../../catalog/sources';
import { APP_VERSION } from '../../config/app';
import { Sheet } from '../../components/Sheet';
import { Switch } from '../../components/Switch';
import { IconExternal } from '../../components/Icons';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  lowPower: boolean;
  onLowPowerChange: (enabled: boolean) => void;
}

export function SettingsDialog({
  open,
  onClose,
  lowPower,
  onLowPowerChange,
}: SettingsDialogProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="تنظیمات و منابع"
      subtitle="نمایش، مصرف منابع و اطلاعات علمی برنامه"
    >
      <section className="settings-section">
        <h3>نمایش</h3>
        <Switch
          checked={lowPower}
          onChange={onLowPowerChange}
          label="حالت کم‌مصرف"
          description="تراکم پیکسلی رندر کاهش می‌یابد؛ مناسب دستگاه‌های ضعیف‌تر یا مصرف کمتر باتری."
        />
      </section>

      <section className="settings-section">
        <h3>دربارهٔ صحنه</h3>
        <p className="settings-text">
          اندازه‌ها و فاصله‌های اجرام در «کاوش آزاد» فشرده و نمایشی‌اند. اطلاعات عددی پنل،
          مستقل از مقیاس بصری و برگرفته از منابع علمی ذکرشده است. در «آسمان واقعی»، جای
          اجرام از محاسبات نجومی می‌آید و شکل نشانه‌ها صرفاً یک نماد رابط کاربری است.
        </p>
        <p className="settings-text">
          این برنامه وضعیت جو، ابرها و دید نجومی واقعی را پیش‌بینی نمی‌کند. ارتفاع محاسبه‌شده
          ارتفاع هندسی است و شکست نور جو در آن لحاظ نشده است.
        </p>
        <p className="settings-text">
          با نزدیک‌شدن دوربین به زمین، جزئیات نقشه از OpenStreetMap به‌تدریج و فقط برای
          ناحیهٔ دیده‌شده بارگذاری می‌شود. این نقشه کارتوگرافی است، نه تصویر ماهواره‌ای.
          درخواست کاشی‌ها محدودهٔ تقریبی نمای فعلی را برای آن سرویس آشکار می‌کند؛ کاشی‌های
          دیده‌شده حداکثر هفت روز در مرورگر کش می‌شوند و دانلود برای آفلاین انجام نمی‌شود.
        </p>
      </section>

      <section className="settings-section">
        <h3>منابع داده‌های علمی</h3>
        <ul className="source-list">
          {Object.values(DATA_SOURCES).map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                <span>{source.titleFa}</span>
                <span className="source-list__meta">
                  {source.publisherFa} · دسترسی {source.accessedOn}
                </span>
                <IconExternal size={14} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h3>دارایی‌ها و مجوزها</h3>
        <ul className="credits-list">
          {ASSET_CREDITS.map((credit) => (
            <li key={credit.id}>
              <strong>{credit.titleFa}</strong>
              <span>{credit.author}</span>
              <span className="credits-list__license">
                {credit.license} ·{' '}
                <a href={credit.licenseUrl} target="_blank" rel="noreferrer noopener">
                  متن مجوز
                </a>{' '}
                ·{' '}
                <a href={credit.sourceUrl} target="_blank" rel="noreferrer noopener">
                  منبع
                </a>
              </span>
              <span className="credits-list__meta">{credit.modificationsFa}</span>
            </li>
          ))}
        </ul>
        <p className="settings-text settings-text--muted">
          کتابخانهٔ محاسباتی Astronomy Engine با مجوز MIT و رابط کاربری با React/Three.js
          ساخته شده است.
        </p>
      </section>

      <p className="settings-version">
        کاوشگر کیهان · نسخهٔ {APP_VERSION} · داده‌ها و متن‌ها برای آموزش عمومی‌اند، نه ناوبری
        دقیق.
      </p>
    </Sheet>
  );
}
