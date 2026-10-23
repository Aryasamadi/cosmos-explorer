import {
  acquireDeviceLocation,
  DeviceLocationError,
  type AcquireDeviceLocationOptions,
  type DeviceLocationEnvironment,
} from './deviceLocation';
import type { GeoLocation } from './types';

export type GeolocationPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

/** Fixes worse than this radius are treated as coarse for automatic camera focus. */
export const COARSE_ACCURACY_THRESHOLD_M = 100;

export interface PermissionQuerySource {
  query(descriptor: { name: 'geolocation' }): Promise<{ state: PermissionState }>;
}

export interface LocationEnvironment extends DeviceLocationEnvironment {
  permissions?: PermissionQuerySource | null;
}

export interface SharedLocationOptions
  extends Omit<AcquireDeviceLocationOptions, 'environment'> {
  environment?: LocationEnvironment;
}

interface ResolvedCoreEnvironment {
  geolocation: Geolocation | null;
  isSecureContext: boolean;
}

function resolveCoreEnvironment(
  environment: LocationEnvironment | undefined,
): ResolvedCoreEnvironment {
  return {
    geolocation:
      environment?.geolocation ??
      (typeof navigator !== 'undefined' ? navigator.geolocation : null) ??
      null,
    isSecureContext:
      environment?.isSecureContext ??
      (typeof window !== 'undefined' ? window.isSecureContext : true),
  };
}

function resolvePermissionSource(
  environment: LocationEnvironment | undefined,
): PermissionQuerySource | null {
  if (environment?.permissions !== undefined) {
    return environment.permissions;
  }
  if (typeof navigator !== 'undefined' && navigator.permissions) {
    return navigator.permissions;
  }
  return null;
}

/**
 * Reads the browser permission state without prompting. Browsers that do not
 * expose the Permissions API (or reject this descriptor) return "unsupported";
 * the caller then lets the geolocation request itself determine the outcome.
 */
export async function readLocationPermission(
  environment?: LocationEnvironment,
): Promise<GeolocationPermissionState> {
  const source = resolvePermissionSource(environment);
  if (!source) return 'unsupported';
  try {
    const status = await source.query({ name: 'geolocation' });
    if (
      status.state === 'granted' ||
      status.state === 'denied' ||
      status.state === 'prompt'
    ) {
      return status.state;
    }
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/**
 * Single entry point for Earth and Sky location requests. Secure-context and
 * API checks happen before any permission query. A known "denied" state is
 * final for this request: the geolocation API is not called and there is no
 * automatic retry.
 */
export async function acquireSharedLocation(
  options: SharedLocationOptions = {},
): Promise<GeoLocation> {
  const environment = options.environment;
  const core = resolveCoreEnvironment(environment);

  if (!core.isSecureContext) {
    throw new DeviceLocationError(
      'insecure-context',
      'Geolocation requires a secure context.',
    );
  }
  if (!core.geolocation) {
    throw new DeviceLocationError(
      'unsupported',
      'The browser does not expose the geolocation API.',
    );
  }
  if (options.signal?.aborted) {
    throw new DeviceLocationError('aborted', 'The location request was cancelled.');
  }

  const permission = await readLocationPermission(environment);
  if (permission === 'denied') {
    throw new DeviceLocationError(
      'permission-denied',
      'Permission to access the device location was denied.',
    );
  }
  if (options.signal?.aborted) {
    throw new DeviceLocationError('aborted', 'The location request was cancelled.');
  }

  return acquireDeviceLocation({
    ...options,
    environment: {
      geolocation: core.geolocation,
      isSecureContext: core.isSecureContext,
    },
  });
}
