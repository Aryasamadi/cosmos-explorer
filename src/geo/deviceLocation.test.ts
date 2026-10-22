import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acquireDeviceLocation,
  describeDeviceLocationErrorFa,
  type DeviceLocationEnvironment,
} from './deviceLocation';

function makePosition(
  latitude = 35.6892,
  longitude = 51.389,
  accuracy = 25,
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: 1200,
      altitudeAccuracy: 10,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 1_760_000_000_000,
    toJSON: () => ({}),
  } as GeolocationPosition;
}

function makeEnvironment(
  overrides: Partial<{
    getCurrentPosition: Geolocation['getCurrentPosition'];
    watchPosition: Geolocation['watchPosition'];
    clearWatch: Geolocation['clearWatch'];
    isSecureContext: boolean;
    geolocation: null;
  }> = {},
): DeviceLocationEnvironment {
  const geolocation = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
    ...overrides,
  } as unknown as Geolocation;
  return {
    geolocation: overrides.geolocation === null ? null : geolocation,
    isSecureContext: overrides.isSecureContext ?? true,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('device geolocation acquisition', () => {
  it('returns the actual device coordinates and reported accuracy', async () => {
    const environment = makeEnvironment();
    environment.geolocation!.getCurrentPosition = vi.fn((success) => {
      success(makePosition());
    });
    const location = await acquireDeviceLocation({ environment });
    expect(location).toMatchObject({
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      accuracyM: 25,
      altitudeM: 1200,
      source: 'device',
    });
    expect(location.timestampMs).toBe(1_760_000_000_000);
  });

  it('requests high accuracy without a stale cached fix', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success(makePosition());
    });
    const environment = makeEnvironment({ getCurrentPosition });
    await acquireDeviceLocation({ environment });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({
        enableHighAccuracy: true,
        maximumAge: 0,
      }),
    );
  });

  it('maps denied, unavailable, and timeout errors distinctly', async () => {
    for (const [code, expected] of [
      [1, 'permission-denied'],
      [2, 'unavailable'],
      [3, 'timeout'],
    ] as const) {
      const environment = makeEnvironment();
      environment.geolocation!.getCurrentPosition = vi.fn((_success, error) => {
        error({ code, message: 'failure' } as GeolocationPositionError);
      });
      await expect(acquireDeviceLocation({ environment })).rejects.toMatchObject({
        code: expected,
      });
    }
  });

  it('reports unsupported and insecure contexts before calling the browser', async () => {
    const unsupported = makeEnvironment({ geolocation: null });
    await expect(acquireDeviceLocation({ environment: unsupported })).rejects.toMatchObject({
      code: 'unsupported',
    });

    const environment = makeEnvironment({ isSecureContext: false });
    await expect(acquireDeviceLocation({ environment })).rejects.toMatchObject({
      code: 'insecure-context',
    });
    expect(environment.geolocation?.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('rejects invalid or non-finite positions', async () => {
    const environment = makeEnvironment();
    environment.geolocation!.getCurrentPosition = vi.fn((success) => {
      success(makePosition(95, 51, 20));
    });
    await expect(acquireDeviceLocation({ environment })).rejects.toMatchObject({
      code: 'invalid-position',
    });
  });

  it('keeps the best fix during a bounded refinement watch', async () => {
    const clearWatch = vi.fn();
    const environment = makeEnvironment();
    environment.geolocation!.watchPosition = vi.fn((success) => {
      success(makePosition(35.6892, 51.389, 120));
      success(makePosition(35.6893, 51.3891, 14));
      return 77;
    });
    environment.geolocation!.clearWatch = clearWatch;

    const location = await acquireDeviceLocation({
      mode: 'refine',
      refineMs: 5000,
      targetAccuracyM: 20,
      environment,
    });
    expect(location.accuracyM).toBe(14);
    expect(location.latitudeDeg).toBeCloseTo(35.6893, 6);
    expect(clearWatch).toHaveBeenCalledWith(77);
    expect(environment.geolocation!.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('stops the watch and rejects when refinement receives no fix', async () => {
    vi.useFakeTimers();
    const clearWatch = vi.fn();
    const environment = makeEnvironment();
    environment.geolocation!.watchPosition = vi.fn(() => 99);
    environment.geolocation!.clearWatch = clearWatch;

    const promise = acquireDeviceLocation({
      mode: 'refine',
      refineMs: 100,
      environment,
    });
    const assertion = expect(promise).rejects.toMatchObject({ code: 'unavailable' });
    await vi.advanceTimersByTimeAsync(101);
    await assertion;
    expect(clearWatch).toHaveBeenCalledWith(99);
  });

  it('honours an aborted signal before starting', async () => {
    const environment = makeEnvironment();
    const controller = new AbortController();
    controller.abort();
    await expect(
      acquireDeviceLocation({ environment, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'aborted' });
  });

  it('provides a Persian explanation for every error code', () => {
    for (const code of [
      'unsupported',
      'insecure-context',
      'permission-denied',
      'unavailable',
      'timeout',
      'aborted',
      'invalid-position',
      'error',
    ] as const) {
      expect(describeDeviceLocationErrorFa(code).length).toBeGreaterThan(10);
    }
  });
});
