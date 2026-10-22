import type { GeoLocation } from './types';

export type DeviceLocationErrorCode =
  | 'unsupported'
  | 'insecure-context'
  | 'permission-denied'
  | 'unavailable'
  | 'timeout'
  | 'aborted'
  | 'invalid-position'
  | 'error';

export class DeviceLocationError extends Error {
  readonly code: DeviceLocationErrorCode;

  constructor(code: DeviceLocationErrorCode, message: string) {
    super(message);
    this.name = 'DeviceLocationError';
    this.code = code;
  }
}

export interface DeviceLocationEnvironment {
  geolocation?: Geolocation | null;
  isSecureContext?: boolean;
}

export interface AcquireDeviceLocationOptions {
  mode?: 'quick' | 'refine';
  timeoutMs?: number;
  refineMs?: number;
  targetAccuracyM?: number;
  signal?: AbortSignal;
  environment?: DeviceLocationEnvironment;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_REFINE_MS = 8_000;
const DEFAULT_TARGET_ACCURACY_M = 20;

function resolveEnvironment(
  environment: DeviceLocationEnvironment | undefined,
): Required<Pick<DeviceLocationEnvironment, 'isSecureContext'>> & {
  geolocation: Geolocation | null;
} {
  const geolocation =
    environment?.geolocation ??
    (typeof navigator !== 'undefined' ? navigator.geolocation : null) ??
    null;
  const isSecureContext =
    environment?.isSecureContext ??
    (typeof window !== 'undefined' ? window.isSecureContext : true);
  return { geolocation, isSecureContext };
}

function toGeoLocation(position: GeolocationPosition): GeoLocation {
  const { latitude, longitude, accuracy, altitude } = position.coords;
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new DeviceLocationError('invalid-position', 'The device returned invalid coordinates.');
  }
  if (!Number.isFinite(accuracy) || accuracy < 0) {
    throw new DeviceLocationError(
      'invalid-position',
      'The device did not return a valid accuracy value.',
    );
  }
  return {
    latitudeDeg: latitude,
    longitudeDeg: longitude,
    accuracyM: accuracy,
    altitudeM:
      altitude !== null && Number.isFinite(altitude) ? altitude : null,
    source: 'device',
    timestampMs: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
  };
}

function mapPositionError(error: GeolocationPositionError): DeviceLocationError {
  switch (error.code) {
    case 1:
      return new DeviceLocationError(
        'permission-denied',
        'Permission to access the device location was denied.',
      );
    case 2:
      return new DeviceLocationError(
        'unavailable',
        'The device location is currently unavailable.',
      );
    case 3:
      return new DeviceLocationError(
        'timeout',
        'The device location request timed out.',
      );
    default:
      return new DeviceLocationError('error', 'The device location request failed.');
  }
}

function abortError(): DeviceLocationError {
  return new DeviceLocationError('aborted', 'The location request was cancelled.');
}

export function describeDeviceLocationErrorFa(code: DeviceLocationErrorCode): string {
  switch (code) {
    case 'unsupported':
      return 'این مرورگر از موقعیت مکانی دستگاه پشتیبانی نمی‌کند. می‌توانید مختصات را دستی وارد کنید.';
    case 'insecure-context':
      return 'دسترسی به موقعیت مکانی فقط در صفحهٔ HTTPS یا localhost ممکن است. نسخهٔ آنلاین سایت از HTTPS استفاده می‌کند.';
    case 'permission-denied':
      return 'اجازهٔ دسترسی به موقعیت مکانی داده نشد. می‌توانید مختصات را دستی وارد کنید.';
    case 'unavailable':
      return 'موقعیت مکانی در دسترس نیست. GPS یا سرویس مکان دستگاه را بررسی کنید.';
    case 'timeout':
      return 'دریافت موقعیت مکانی بیش از حد طول کشید. دوباره تلاش کنید یا مختصات را دستی وارد کنید.';
    case 'aborted':
      return 'درخواست موقعیت مکانی لغو شد.';
    case 'invalid-position':
      return 'دستگاه مختصات معتبری برنگرداند. دوباره تلاش کنید یا مختصات را دستی وارد کنید.';
    default:
      return 'دریافت موقعیت مکانی با خطا روبه‌رو شد. گزینهٔ ورود دستی مختصات در دسترس است.';
  }
}

function watchForBestFix(
  geolocation: Geolocation,
  options: PositionOptions,
  refineMs: number,
  targetAccuracyM: number,
  signal: AbortSignal | undefined,
): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let best: GeoLocation | null = null;
    let settled = false;

    const finish = (error?: DeviceLocationError): void => {
      if (settled) return;
      settled = true;
      if (watchId !== null) {
        geolocation.clearWatch(watchId);
        watchId = null;
      }
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error) {
        reject(error);
      } else if (best) {
        resolve(best);
      } else {
        reject(new DeviceLocationError('unavailable', 'No location fix was received.'));
      }
    };

    const onAbort = (): void => finish(abortError());
    const timer = setTimeout(() => finish(), refineMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      finish(abortError());
      return;
    }

    try {
      watchId = geolocation.watchPosition(
        (position) => {
          try {
            const fix = toGeoLocation(position);
            if (!best || (fix.accuracyM ?? Infinity) < (best.accuracyM ?? Infinity)) {
              best = fix;
            }
            if ((best.accuracyM ?? Infinity) <= targetAccuracyM) {
              finish();
            }
          } catch (error) {
            finish(
              error instanceof DeviceLocationError
                ? error
                : new DeviceLocationError('invalid-position', 'Invalid position.'),
            );
          }
        },
        (error) => finish(mapPositionError(error)),
        options,
      );
      // A fake or unusual implementation may invoke the success callback
      // synchronously, before watchPosition has returned its id.
      if (settled && watchId !== null) {
        geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (watchId === null) {
        finish(new DeviceLocationError('unsupported', 'Location watch could not start.'));
      }
    } catch {
      finish(new DeviceLocationError('error', 'Location watch could not start.'));
    }
  });
}

/**
 * Requests the browser's actual device location. There is no IP-based
 * fallback: if the device cannot provide a location, the caller must show an
 * error and offer manual coordinates.
 */
export async function acquireDeviceLocation(
  options: AcquireDeviceLocationOptions = {},
): Promise<GeoLocation> {
  const { geolocation, isSecureContext } = resolveEnvironment(options.environment);
  if (!isSecureContext) {
    throw new DeviceLocationError(
      'insecure-context',
      'Geolocation requires a secure context.',
    );
  }
  if (!geolocation) {
    throw new DeviceLocationError(
      'unsupported',
      'The browser does not expose the geolocation API.',
    );
  }
  if (options.signal?.aborted) {
    throw abortError();
  }

  const mode = options.mode ?? 'quick';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const positionOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: timeoutMs,
    maximumAge: 0,
  };

  if (mode === 'refine') {
    return watchForBestFix(
      geolocation,
      positionOptions,
      options.refineMs ?? DEFAULT_REFINE_MS,
      options.targetAccuracyM ?? DEFAULT_TARGET_ACCURACY_M,
      options.signal,
    );
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = (): void => reject(abortError());
    options.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      geolocation.getCurrentPosition(
        (result) => {
          options.signal?.removeEventListener('abort', onAbort);
          resolve(result);
        },
        (error) => {
          options.signal?.removeEventListener('abort', onAbort);
          reject(mapPositionError(error));
        },
        positionOptions,
      );
    } catch {
      options.signal?.removeEventListener('abort', onAbort);
      reject(new DeviceLocationError('error', 'The geolocation request could not start.'));
    }
  });

  try {
    return toGeoLocation(position);
  } catch (error) {
    if (error instanceof DeviceLocationError) throw error;
    throw new DeviceLocationError('invalid-position', 'Invalid position.');
  }
}
