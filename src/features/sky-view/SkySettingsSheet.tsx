import { useState } from 'react';
import type { ObserverLocation } from '../../astronomy/types';
import type { SensorStatusSnapshot } from '../../sensors/DeviceOrientationService';
import {
  formatDateInputValue,
  formatLocalDateTime,
  formatNumber,
  formatObserverLocation,
  formatTimezoneName,
  formatUtcDateTime,
} from '../../app/format';
import { Sheet } from '../../components/Sheet';
import { Switch } from '../../components/Switch';
import { Notice } from '../../components/Notice';
import { ManualLocationForm } from './ManualLocationForm';
import { IconClock, IconPin, IconSensor } from '../../components/Icons';

interface SkySettingsSheetProps {
  open: boolean;
  onClose: () => void;
  location: ObserverLocation;
  locationStatus: 'idle' | 'requesting' | 'denied' | 'error';
  locationMessage: string | null;
  onRequestLocation: () => void;
  onManualLocation: (location: ObserverLocation) => void;
  date: Date;
  liveTime: boolean;
  onLiveTimeChange: (enabled: boolean) => void;
  onDateChange: (date: Date) => void;
  headingOffset: number;
  onHeadingOffsetChange: (offset: number) => void;
  fov: number;
  onFovChange: (fov: number) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  sensorStatus: SensorStatusSnapshot;
}

function sensorStatusLabel(status: SensorStatusSnapshot): string {
  switch (status.status) {
    case 'active':
      return status.absolute
        ? 'حسگر فعال است و مرجع آن شمال حقیقی گزارش می‌شود.'
        : 'حسگر فعال است، اما مرجع آن شمال حقیقی نیست.';
    case 'waiting':
      return 'در انتظار نخستین دادهٔ حسگر…';
    case 'requesting':
      return 'در حال درخواست اجازهٔ دسترسی…';
    case 'denied':
      return 'اجازهٔ دسترسی به حسگر رد شد.';
    case 'unsupported':
      return 'این مرورگر از حسگر جهت‌یابی پشتیبانی نمی‌کند.';
    case 'unavailable':
      return 'دادهٔ حسگر در دسترس نیست.';
    case 'error':
      return 'خطا در دریافت دادهٔ حسگر.';
    default:
      return 'حسگر خاموش است؛ آسمان با چرخش آزاد کنترل می‌شود.';
  }
}

export function SkySettingsSheet({
  open,
  onClose,
  location,
  locationStatus,
  locationMessage,
  onRequestLocation,
  onManualLocation,
  date,
  liveTime,
  onLiveTimeChange,
  onDateChange,
  headingOffset,
  onHeadingOffsetChange,
  fov,
  onFovChange,
  showGrid,
  onShowGridChange,
  sensorStatus,
}: SkySettingsSheetProps) {
  const [manualOpen, setManualOpen] = useState(false);

  const handleDateInput = (value: string): void => {
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      onDateChange(parsed);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="مکان، زمان و کالیبراسیون"
      subtitle="همهٔ محاسبات با مکان و زمان انتخاب‌شده انجام می‌شود"
    >
      <section className="settings-section">
        <h3>
          <IconPin size={17} /> مکان ناظر
        </h3>
        <div className="current-value">
          <strong>{formatObserverLocation(location)}</strong>
          <span>
            منبع: {location.source === 'geolocation' ? 'موقعیت دستگاه' : 'ورود دستی'}
            {location.accuracyM
              ? ` · دقت گزارش‌شدهٔ حدود ${formatNumber(location.accuracyM, 0)} متر`
              : ''}
            {location.heightM ? ` · ارتفاع ${formatNumber(location.heightM, 0)} متر` : ''}
          </span>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="button button--glass"
            onClick={onRequestLocation}
            disabled={locationStatus === 'requesting'}
          >
            <IconPin size={16} />
            {locationStatus === 'requesting' ? 'در حال دریافت…' : 'به‌روزرسانی با GPS'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setManualOpen((value) => !value)}
          >
            {manualOpen ? 'بستن ورود دستی' : 'ورود مختصات دستی'}
          </button>
        </div>
        {manualOpen ? (
          <ManualLocationForm
            initialLocation={location}
            submitLabel="ثبت این مختصات"
            onSubmit={(nextLocation) => {
              onManualLocation(nextLocation);
              setManualOpen(false);
            }}
            onCancel={() => setManualOpen(false)}
          />
        ) : null}
        {locationMessage ? <Notice tone="warning">{locationMessage}</Notice> : null}
      </section>

      <section className="settings-section">
        <h3>
          <IconClock size={17} /> زمان مشاهده
        </h3>
        <Switch
          checked={liveTime}
          onChange={onLiveTimeChange}
          label="همگام با زمان اکنون"
          description="اگر خاموش باشد، زمان انتخابی ثابت می‌ماند و می‌توانید آسمان را در گذشته یا آینده ببینید."
        />
        <label className="form-field time-field">
          <span>تاریخ و ساعت محلی</span>
          <input
            type="datetime-local"
            value={formatDateInputValue(date)}
            onChange={(event) => handleDateInput(event.target.value)}
            disabled={liveTime}
            min="1900-01-01T00:00"
            max="2100-12-31T23:59"
            dir="ltr"
          />
        </label>
        <div className="time-summary">
          <span>زمان محلی: {formatLocalDateTime(date)}</span>
          <span>UTC: {formatUtcDateTime(date)}</span>
          <span>منطقهٔ زمانی: {formatTimezoneName(date)}</span>
        </div>
        <p className="settings-text settings-text--muted">
          زمان ورودی به وقت محلی همین دستگاه تفسیر می‌شود و برای محاسبه به UTC تبدیل می‌گردد.
        </p>
      </section>

      <section className="settings-section">
        <h3>
          <IconSensor size={17} /> کالیبراسیون
        </h3>
        <p className="settings-text">{sensorStatusLabel(sensorStatus)}</p>
        {sensorStatus.messageFa ? (
          <Notice tone={sensorStatus.status === 'active' ? 'info' : 'warning'}>
            {sensorStatus.messageFa}
          </Notice>
        ) : null}

        <div className="slider-field">
          <div className="slider-field__label">
            <span>اصلاح جهت افقی (کالیبراسیون دستی)</span>
            <strong>{formatNumber(headingOffset, 0)}°</strong>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={headingOffset}
            onChange={(event) => onHeadingOffsetChange(Number(event.target.value))}
            aria-label="اصلاح جهت افقی"
          />
          <p className="slider-field__hint">
            اگر شمالِ نمایش با جهت واقعی شما اختلاف دارد، با این لغزنده آن را اصلاح کنید. این
            اصلاح به خطای قطب‌نما، حسگر یا جهت صفحه جبران می‌کند و فقط وقتی حسگر فعال است
            اثر دارد.
          </p>
        </div>

        <div className="slider-field">
          <div className="slider-field__label">
            <span>میدان دید تقریبی دوربین</span>
            <strong>{formatNumber(fov, 0)}°</strong>
          </div>
          <input
            type="range"
            min={35}
            max={100}
            step={1}
            value={fov}
            onChange={(event) => onFovChange(Number(event.target.value))}
            aria-label="میدان دید"
          />
          <p className="slider-field__hint">
            مرورگر میدان دید دقیق دوربین گوشی را گزارش نمی‌کند. برای هم‌راستاشدن لایهٔ مجازی با
            تصویر دوربین، این مقدار را به‌صورت دستی تنظیم کنید.
          </p>
        </div>

        <p className="settings-text settings-text--muted">
          دقت جهت‌یابی به قطب‌نما و حسگر دستگاه، مرورگر و جهت صفحه وابسته است. این نسخه روی
          گوشی واقعی صحت‌سنجی نشده و لایهٔ دوربین یک هم‌ترازی تقریبی است، نه AR دقیق یا
          ARKit/ARCore.
        </p>

        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            onHeadingOffsetChange(0);
            onFovChange(65);
          }}
        >
          بازنشانی کالیبراسیون
        </button>
      </section>

      <section className="settings-section">
        <h3>نمایش آسمان</h3>
        <Switch
          checked={showGrid}
          onChange={onShowGridChange}
          label="شبکهٔ ارتفاع و سمت"
          description="دایره‌های ارتفاع و خطوط سمت برای جهت‌یابی روی گنبد آسمان."
        />
        <p className="settings-text settings-text--muted">
          موقعیت مکان و تصویر دوربین به هیچ سروری ارسال نمی‌شود. دادهٔ حسگرها فقط برای چرخش
          نمای محلی استفاده می‌شود. این نسخه فقط چند ستارهٔ درخشان را به‌عنوان زمینه نمایش
          می‌دهد و کاتالوگ کامل ستارگان نیست.
        </p>
      </section>
    </Sheet>
  );
}
