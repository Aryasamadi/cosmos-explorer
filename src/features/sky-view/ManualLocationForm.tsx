import { useState, type FormEvent } from 'react';
import { parseLocationInput, type LocationField } from '../../astronomy/validation/input';
import type { ObserverLocation } from '../../astronomy/types';

interface ManualLocationFormProps {
  initialLocation?: ObserverLocation | null;
  submitLabel?: string;
  onSubmit: (location: ObserverLocation) => void;
  onCancel?: () => void;
}

const ERROR_MESSAGES: Record<LocationField, string> = {
  format: 'مقدار واردشده عدد معتبری نیست. از ارقام فارسی یا لاتین و اعشار با نقطه استفاده کنید.',
  latitude: 'عرض جغرافیایی باید بین ۹۰- و ۹۰ درجه باشد.',
  longitude: 'طول جغرافیایی باید بین ۱۸۰- و ۱۸۰ درجه باشد.',
  height: 'ارتفاع باید بین ۵۰۰- و ۱۰٬۰۰۰ متر باشد.',
};

export function ManualLocationForm({
  initialLocation = null,
  submitLabel = 'استفاده از این مکان',
  onSubmit,
  onCancel,
}: ManualLocationFormProps) {
  const [latitude, setLatitude] = useState(
    initialLocation ? String(initialLocation.latitudeDeg) : '',
  );
  const [longitude, setLongitude] = useState(
    initialLocation ? String(initialLocation.longitudeDeg) : '',
  );
  const [height, setHeight] = useState(
    initialLocation ? String(initialLocation.heightM) : '0',
  );
  const [errorField, setErrorField] = useState<LocationField | null>(null);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const result = parseLocationInput(latitude, longitude, height);
    if (!result.ok) {
      setErrorField(result.field);
      return;
    }
    setErrorField(null);
    onSubmit(result.location);
  };

  return (
    <form className="manual-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label className="form-field">
          <span>عرض جغرافیایی (°)</span>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="مثلاً 35.6892"
            aria-invalid={errorField === 'latitude' || errorField === 'format'}
            aria-describedby="latitude-hint"
          />
          <small id="latitude-hint">مثبت برای نیم‌کرهٔ شمالی؛ منفی برای جنوبی.</small>
        </label>
        <label className="form-field">
          <span>طول جغرافیایی (°)</span>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="مثلاً 51.3890"
            aria-invalid={errorField === 'longitude' || errorField === 'format'}
            aria-describedby="longitude-hint"
          />
          <small id="longitude-hint">مثبت برای شرق گرینویچ؛ منفی برای غرب.</small>
        </label>
        <label className="form-field form-field--full">
          <span>ارتفاع از سطح دریا (متر، اختیاری)</span>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={height}
            onChange={(event) => setHeight(event.target.value)}
            aria-invalid={errorField === 'height'}
          />
        </label>
      </div>

      {errorField ? (
        <p className="form-error" role="alert">
          {ERROR_MESSAGES[errorField]}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="button button--primary">
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="button button--ghost" onClick={onCancel}>
            انصراف
          </button>
        ) : null}
      </div>
      <p className="form-privacy">
        مختصات واردشده فقط در همین مرورگر برای محاسبهٔ موضع اجرام استفاده می‌شود.
      </p>
    </form>
  );
}
