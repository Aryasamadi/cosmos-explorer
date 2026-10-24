import { useState } from 'react';
import type { ObserverLocation } from '../../astronomy/types';
import { ManualLocationForm } from './ManualLocationForm';
import { Notice } from '../../components/Notice';
import { IconCompass, IconPin, IconSensor } from '../../components/Icons';

interface ObserverSetupProps {
  requesting: boolean;
  errorMessage: string | null;
  onRequestLocation: () => void;
  onManualLocation: (location: ObserverLocation) => void;
}

export function ObserverSetup({
  requesting,
  errorMessage,
  onRequestLocation,
  onManualLocation,
}: ObserverSetupProps) {
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <div className="setup-screen">
      <div className="setup-card glass">
        <div className="setup-card__icon">
          <IconCompass size={34} />
        </div>
        <p className="eyebrow">حالت آسمان واقعی</p>
        <h2 className="setup-card__title">آسمان از کجا دیده می‌شود؟</h2>
        <p className="setup-card__lead">
          برای محاسبهٔ موقعیت خورشید، ماه، مریخ و ستارگان، مکان ناظر و زمان لازم است.
          مکان فقط روی همین دستگاه پردازش می‌شود.
        </p>

        {!manualOpen ? (
          <div className="setup-actions">
            <button
              type="button"
              className="button button--primary button--wide"
              onClick={onRequestLocation}
              disabled={requesting}
            >
              <IconPin size={18} />
              {requesting ? 'در حال دریافت موقعیت…' : 'استفاده از موقعیت فعلی'}
            </button>
            <button
              type="button"
              className="button button--glass button--wide"
              onClick={() => setManualOpen(true)}
            >
              <IconSensor size={18} />
              ورود مختصات به‌صورت دستی
            </button>
          </div>
        ) : (
          <div className="setup-manual">
            <h2>مختصات ناظر</h2>
            <ManualLocationForm
              onSubmit={onManualLocation}
              onCancel={() => setManualOpen(false)}
            />
          </div>
        )}

        {errorMessage ? (
          <Notice tone="danger" role="alert">
            {errorMessage}
          </Notice>
        ) : null}

        <p className="setup-card__privacy">
          <IconSensor size={14} />
          اجازهٔ مکان و حسگر جداگانه و فقط با انتخاب شما درخواست می‌شود؛ ردکردن هر کدام
          مانع استفاده از بقیهٔ بخش‌ها نیست.
        </p>
      </div>
    </div>
  );
}
