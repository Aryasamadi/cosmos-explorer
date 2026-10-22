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
import {
  formatAccuracy,
  formatGeoSource,
  formatObserverLocation,
  formatNumber,
} from '../../app/format';
import { Sheet } from '../../components/Sheet';
import { Notice } from '../../components/Notice';
import { ManualLocationForm } from '../sky-view/ManualLocationForm';
import { IconPin, IconTarget } from '../../components/Icons';

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
        setRefineNote('دقت بهبود یافت.');
      } else {
        setRefineNote('دقت بهتری دریافت نشد.');
      }
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setErrorCode(error instanceof DeviceLocationError ? error.code : 'error');
    } finally {
      if (mountedRef.current) setBusy('idle');
    }
  };

  const lowAccuracy =
    location?.source === 'device' &&
    location.accuracyM !== null &&
    location.accuracyM > 100;

  const primaryLabel =
    busy === 'requesting'
      ? 'در حال دریافت…'
      : errorCode
        ? 'تلاش دوباره'
        : location
          ? 'به‌روزرسانی موقعیت'
          : 'دریافت موقعیت دستگاه';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="موقعیت من"
      subtitle="مکان روی کره و دقت گزارش‌شدهٔ دستگاه"
    >
      <section className="settings-section">
        <h3>
          <IconPin size={17} /> موقعیت فعلی
        </h3>
        {location ? (
          <div className="current-value">
            <strong>{formatObserverLocation(location)}</strong>
            <span>
              {formatGeoSource(location.source)} ·{' '}
              {location.accuracyM === null
                ? 'دقت دستگاه نامشخص'
                : formatAccuracy(location.accuracyM)}
            </span>
            {location.altitudeM !== null ? (
              <span>ارتفاع: {formatNumber(location.altitudeM, 0)} متر</span>
            ) : null}
          </div>
        ) : (
          <p className="settings-text">هنوز موقعیتی ثبت نشده است.</p>
        )}

        <div className="inline-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void runLocationRequest('quick')}
            disabled={busy !== 'idle'}
          >
            <IconPin size={16} />
            {primaryLabel}
          </button>
          <button
            type="button"
            className="button button--glass"
            onClick={() => setManualOpen((value) => !value)}
          >
            {manualOpen ? 'بستن ورود دستی' : 'ورود مختصات دستی'}
          </button>
        </div>

        {location ? (
          <div className="inline-actions">
            <button
              type="button"
              className="button button--glass"
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
                className="button button--ghost"
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
        ) : null}

        {busy === 'refining' ? (
          <p className="settings-text settings-text--muted" role="status">
            در حال جست‌وجوی دقت بهتر…
          </p>
        ) : null}
        {refineNote ? <Notice tone="info">{refineNote}</Notice> : null}
        {lowAccuracy ? (
          <Notice tone="warning">
            دقت گزارش‌شده پایین است ({formatNumber(location.accuracyM ?? 0, 0)} متر)؛ ممکن است
            مکان واقعی چند صد متر فاصله داشته باشد.
          </Notice>
        ) : null}
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

      <p className="settings-text settings-text--muted">
        دقت گزارش‌شده تضمین GPS نیست و مختصات فقط در همین مرورگر می‌ماند. برای جزئیات نقشه،
        محدودهٔ تقریبی نما به OpenStreetMap فرستاده می‌شود؛ مختصات دقیق دستگاه مستقیماً ارسال
        نمی‌شود.
      </p>
      <div className="map-credit-links">
        <a href={OSM_RASTER_TILES.attributionUrl} target="_blank" rel="noreferrer noopener">
          {OSM_RASTER_TILES.attributionText}
        </a>
        <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer noopener">
          گزارش مشکل نقشه
        </a>
        <a href={OSM_RASTER_TILES.policyUrl} target="_blank" rel="noreferrer noopener">
          شرایط سرویس نقشه
        </a>
      </div>
    </Sheet>
  );
}
