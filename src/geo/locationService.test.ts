import { describe, expect, it, vi } from 'vitest';
import { acquireSharedLocation, readLocationPermission } from './locationService';
import type { LocationEnvironment } from './locationService';

function makePosition(): GeolocationPosition {
  return {
    coords: {
      latitude: 30.0444,
      longitude: 31.2357,
      accuracy: 25,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 1_760_000_000_000,
    toJSON: () => ({}),
  } as GeolocationPosition;
}

function makeEnvironment(
  permission: PermissionState | 'unsupported' | 'throws',
): {
  environment: LocationEnvironment;
  getCurrentPosition: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
} {
  const getCurrentPosition = vi.fn((success: PositionCallback) => success(makePosition()));
  const query = vi.fn(async () => {
    if (permission === 'throws') throw new Error('permissions unavailable');
    return { state: permission === 'unsupported' ? 'prompt' : permission };
  });
  return {
    environment: {
      isSecureContext: true,
      geolocation: {
        getCurrentPosition,
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      } as unknown as Geolocation,
      ...(permission === 'unsupported' ? { permissions: null } : { permissions: { query } }),
    },
    getCurrentPosition,
    query,
  };
}

describe('shared location service', () => {
  it('reads permission states without prompting', async () => {
    expect(await readLocationPermission(makeEnvironment('granted').environment)).toBe(
      'granted',
    );
    expect(await readLocationPermission(makeEnvironment('denied').environment)).toBe(
      'denied',
    );
    expect(await readLocationPermission(makeEnvironment('prompt').environment)).toBe(
      'prompt',
    );
    expect(await readLocationPermission(makeEnvironment('unsupported').environment)).toBe(
      'unsupported',
    );
    expect(await readLocationPermission(makeEnvironment('throws').environment)).toBe(
      'unsupported',
    );
  });

  it('does not call geolocation when permission is already denied', async () => {
    const { environment, getCurrentPosition } = makeEnvironment('denied');
    await expect(acquireSharedLocation({ environment })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('requests a fix when permission is prompt or granted', async () => {
    for (const permission of ['prompt', 'granted'] as const) {
      const { environment, getCurrentPosition } = makeEnvironment(permission);
      const location = await acquireSharedLocation({ environment });
      expect(location).toMatchObject({
        latitudeDeg: 30.0444,
        longitudeDeg: 31.2357,
        accuracyM: 25,
        source: 'device',
      });
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    }
  });

  it('proceeds when the Permissions API is unsupported or fails', async () => {
    for (const permission of ['unsupported', 'throws'] as const) {
      const { environment, getCurrentPosition } = makeEnvironment(permission);
      const location = await acquireSharedLocation({ environment });
      expect(location.source).toBe('device');
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects insecure contexts and unsupported browsers before permission queries', async () => {
    const insecure = makeEnvironment('granted');
    insecure.environment.isSecureContext = false;
    await expect(acquireSharedLocation({ environment: insecure.environment })).rejects.toMatchObject(
      { code: 'insecure-context' },
    );
    expect(insecure.query).not.toHaveBeenCalled();
    expect(insecure.getCurrentPosition).not.toHaveBeenCalled();

    const unsupported = makeEnvironment('granted');
    unsupported.environment.geolocation = null;
    await expect(
      acquireSharedLocation({ environment: unsupported.environment }),
    ).rejects.toMatchObject({ code: 'unsupported' });
    expect(unsupported.query).not.toHaveBeenCalled();
  });
});
