import { useEffect, useRef, useState } from 'react';
import type { ObserverLocation } from '../../astronomy/types';
import {
  acquireDeviceLocation,
  describeDeviceLocationErrorFa,
  DeviceLocationError,
  type DeviceLocationErrorCode,
} from '../../geo/deviceLocation';
import type { GeoLocation } from '../../geo/types';
import { OSM_RASTER_TILES } from '../../geo/tiles/tileProvider';
import { formatAccuracy, formatGeoSource, formatObserverLocation, formatNumber } from '../../app/format';
import { Sheet } from '../../components/Sheet';
import { Notice } from '../../components/Notice';
import { ManualLocationForm } from '../sky-view/ManualLocationForm';
import { IconExternal, IconPin, IconTarget } from '../../components/Icons';

interface EarthLocationSheetProps {
  open: boolean;
  onClose: () => void;
  location: GeoLocation | null;
  onUseLocation: (location: GeoLocation) => void;
  onUpdateLocation: (location: GeoLocation) => void;
  onFocus: (location: GeoLocation) => void;
  onClear: () => void;
}

type BusyState = 'idle' | 'requesting' | 'refining';

function manualToGeoLocation(observer: ObserverLocation): GeoLocation {
  return {
    latitudeDeg: observer.latitudeDeg,
    longitudeDeg: observer.longitudeDeg,
    accuracyM: null,
    altitudeM: Number.isFinite(observer.heightM) ? observer.heightM : null,
    source: 'manual',
    timestampMs: Date.now(),
  };
}

export function EarthLocationSheet({
  open,
  onClose,
  location,
  onUseLocation,
  onUpdateLocation,
  onFocus,
  onClear,
}: EarthLocationSheetProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState<BusyState>('idle');
  const [errorCode, setErrorCode] = useState<DeviceLocationErrorCode | null>(null);
  const [refineNote, setRefineNote] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const runLocationRequest = async (mode: 'quick' | 'refine'): Promise<void> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(mode === 'quick' ? 'requesting' : 'refining');
    setErrorCode(null);
    setRefineNote(null);
    try {
      const fix = await acquireDeviceLocation({ mode, signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;
      if (mode === 'quick') {
        onUseLocation(fix);
        onClose();
        return;
      }
      const currentAccuracy = location?.accuracyM ?? Number.POSITIVE_INFINITY;
      const nextAccuracy = fix.accuracyM ?? Number.POSITIVE_INFINITY;
      if (nextAccuracy < currentAccuracy) {
        onUpdateLocation(fix);
        setRefineNote('دقت گزارش‌شده بهبود یافت.');
      } else {
        setRefineNote('دقت بهتری از دستگاه دریافت نشد؛ همان موقعیت قبلی حفظ شد.');
      }
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return;
      const code =
        error instanceof DeviceLocationError ? error.code : 'error';
      setErrorCode(code);
    } finally {
      if (mountedRef.current) setBusy('idle');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="موقعیت من روی زمین"
      subtitle="مکان شما با مختصات جغرافیایی واقعی روی کره مشخص می‌شود"
    >
      <section className="settings-section">
        <h3>
          <IconPin size={17} /> موقعیت فعلی
        </h3>
        {location ? (
          <>
            <div className="current-value">
              <strong>{formatObserverLocation(location)}</strong>
              <span>
                {formatGeoSource(location.source)} ·{' '}
                {location.accuracyM === null
                  ? 'دقت دستگاه نامشخص است'
                  : formatAccuracy(location.accuracyM)}
              </span>
              {location.altitudeM !== null ? (
                <span>ارتفاع گزارش‌شده: {formatNumber(location.altitudeM, 0)} متر</span>
              ) : null}
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  onFocus(location);
                  onClose();
                }}
              >
                <IconTarget size={16} />
                نمایش روی زمین
              </button>
              {location.source === 'device' &&
              (location.accuracyM === null || location.accuracyM > 30) ? (
                <button
                  type="button"
                  className="button button--glass"
                  onClick={() => void runLocationRequest('refine')}
                  disabled={busy !== 'idle'}
                >
                  {busy === 'refining' ? 'در حال بهبود دقت…' : 'بهبود دقت'}
                </button>
              ) : null}
              <button type="button" className="button button--ghost" onClick={onClear}>
                حذف موقعیت
              </button>
            </div>
          </>
        ) : (
          <p className="settings-text">
            هنوز موقعیتی ثبت نشده است. با اجازهٔ شما، مرورگر می‌تواند مکان دستگاه را بخواند.
            در صورت ردشدن اجازه یا نبود حسگر، مختصات را دستی وارد کنید.
          </p>
        )}

        <div className="inline-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void runLocationRequest('quick')}
            disabled={busy !== 'idle'}
          >
            <IconPin size={16} />
            {busy === 'requesting'
              ? 'در حال دریافت موقعیت…'
              : location
                ? 'به‌روزرسانی موقعیت دستگاه'
                : 'دریافت موقعیت دستگاه'}
          </button>
          <button
            type="button"
            className="button button--glass"
            onClick={() => setManualOpen((value) => !value)}
          >
            {manualOpen ? 'بستن ورود دستی' : 'ورود مختصات دستی'}
          </button>
        </div>
        {busy === 'refining' ? (
          <p className="settings-text settings-text--muted" role="status">
            در حال جست‌وجوی بهترین دقت در چند ثانیهٔ آینده… برای توقف، پنجره را ببندید.
          </p>
        ) : null}
        {location &&
        location.source === 'device' &&
        location.accuracyM !== null &&
        location.accuracyM > 100 ? (
          <Notice tone="warning">
            دقت گزارش‌شدهٔ این موقعیت پایین است ({formatNumber(location.accuracyM, 0)} متر).
            ممکن است مکان واقعی شما چند صد متر یا بیشتر فاصله داشته باشد.
          </Notice>
        ) : null}
        {refineNote ? <Notice tone="info">{refineNote}</Notice> : null}
        {errorCode ? (
          <Notice tone="danger" role="alert">
            {describeDeviceLocationErrorFa(errorCode)}
          </Notice>
        ) : null}
        {manualOpen ? (
          <ManualLocationForm
            initialLocation={
              location
                ? {
                    latitudeDeg: location.latitudeDeg,
                    longitudeDeg: location.longitudeDeg,
                    heightM: location.altitudeM ?? 0,
                    source: 'manual',
                  }
                : null
            }
            submitLabel="ثبت این مختصات روی زمین"
            onSubmit={(observer) => {
              onUseLocation(manualToGeoLocation(observer));
              onClose();
            }}
            onCancel={() => setManualOpen(false)}
          />
        ) : null}
      </section>

      <section className="settings-section">
        <h3>دقت موقعیت</h3>
        <p className="settings-text">
          موقعیت مرورگر تضمین GPS دقیق نیست. عدد «شعاع دقت» همان مقداری است که دستگاه گزارش
          می‌کند و ممکن است دقت واقعی بیشتر یا کمتر باشد. برنامه هیچ موقعیت تقریبی مبتنی بر
          IP نمی‌سازد و فقط موقعیت واقعی دستگاه یا ورودی دستی را می‌پذیرد.
        </p>
        <p className="settings-text settings-text--muted">
          خواندن موقعیت فقط با دکمه و پس از اجازهٔ مرورگر انجام می‌شود. اکنون مختصات فقط در
          حافظهٔ همین زبانه پردازش می‌شود و ذخیره یا ارسال نمی‌گردد.
        </p>
      </section>

      <section className="settings-section">
        <h3>جزئیات نقشه</h3>
        <p className="settings-text">
          با نزدیک‌شدن دوربین، جزئیات {OSM_RASTER_TILES.nameFa} به‌صورت تدریجی و فقط
          برای ناحیهٔ دیده‌شده بارگذاری می‌شود. این نقشه کارتوگرافی است و تصویر ماهواره‌ای
          نیست؛ ممکن است برخی خیابان‌ها یا نام‌ها ناقص باشند.
        </p>
        <p className="settings-text settings-text--muted">
          درخواست کاشی‌های نقشه محدودهٔ تقریبی نمای فعلی را برای سرویس
          OpenStreetMap آشکار می‌کند. مختصات دقیق دستگاه به‌صورت مستقیم ارسال نمی‌شود.
        </p>
        <div className="map-credit-links">
          <a href={OSM_RASTER_TILES.attributionUrl} target="_blank" rel="noreferrer noopener">
            {OSM_RASTER_TILES.attributionText}
            <IconExternal size={13} />
          </a>
          <a
            href="https://www.openstreetmap.org/fixthemap"
            target="_blank"
            rel="noreferrer noopener"
          >
            گزارش مشکل نقشه
            <IconExternal size={13} />
          </a>
          <a href={OSM_RASTER_TILES.policyUrl} target="_blank" rel="noreferrer noopener">
            شرایط استفادهٔ سرویس کاشی
            <IconExternal size={13} />
          </a>
        </div>
      </section>
    </Sheet>
  );
}
