// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceOrientationService } from './DeviceOrientationService';

interface FakeEventInit {
  alpha?: number;
  beta?: number;
  gamma?: number;
  absolute?: boolean;
  webkitCompassHeading?: number;
}

class FakeDeviceOrientationEvent extends Event {
  static requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>(
    async () => 'granted',
  );

  readonly alpha: number | null;
  readonly beta: number | null;
  readonly gamma: number | null;
  readonly absolute: boolean;
  readonly webkitCompassHeading?: number;

  constructor(type: string, init: FakeEventInit = {}) {
    super(type);
    this.alpha = init.alpha ?? null;
    this.beta = init.beta ?? null;
    this.gamma = init.gamma ?? null;
    this.absolute = init.absolute ?? false;
    if (init.webkitCompassHeading !== undefined) {
      this.webkitCompassHeading = init.webkitCompassHeading;
    }
  }
}

const originalDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'DeviceOrientationEvent',
);

function installSensorConstructor(value: unknown): void {
  Object.defineProperty(window, 'DeviceOrientationEvent', {
    configurable: true,
    writable: true,
    value,
  });
}

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(window, 'DeviceOrientationEvent', originalDescriptor);
  } else {
    delete (window as unknown as Record<string, unknown>).DeviceOrientationEvent;
  }
  FakeDeviceOrientationEvent.requestPermission.mockReset();
  FakeDeviceOrientationEvent.requestPermission.mockResolvedValue('granted');
});

describe('DeviceOrientationService', () => {
  it('reports unsupported browsers without requesting anything', async () => {
    delete (window as unknown as Record<string, unknown>).DeviceOrientationEvent;
    const service = new DeviceOrientationService();
    const status = await service.enable();
    expect(status.status).toBe('unsupported');
    expect(status.messageFa).toContain('پشتیبانی');
    service.dispose();
  });

  it('reports a denied permission and remains usable for manual look', async () => {
    installSensorConstructor(FakeDeviceOrientationEvent);
    FakeDeviceOrientationEvent.requestPermission.mockResolvedValue('denied');
    const service = new DeviceOrientationService();
    const status = await service.enable();
    expect(status.status).toBe('denied');
    expect(status.messageFa).toContain('چرخش آزاد');
    service.dispose();
  });

  it('handles permission request failures', async () => {
    installSensorConstructor(FakeDeviceOrientationEvent);
    FakeDeviceOrientationEvent.requestPermission.mockRejectedValue(
      new Error('not allowed'),
    );
    const service = new DeviceOrientationService();
    const status = await service.enable();
    expect(status.status).toBe('denied');
    service.dispose();
  });

  it('becomes active only after a real reading and exposes an absolute sample', async () => {
    installSensorConstructor(FakeDeviceOrientationEvent);
    const service = new DeviceOrientationService();
    const statuses: string[] = [];
    const readings: unknown[] = [];
    service.subscribeStatus((snapshot) => statuses.push(snapshot.status));
    service.subscribeReadings((sample) => readings.push(sample));

    const enabled = await service.enable();
    expect(enabled.status).toBe('waiting');
    expect(service.getSnapshot().status).toBe('waiting');

    window.dispatchEvent(
      new FakeDeviceOrientationEvent('deviceorientationabsolute', {
        alpha: 12,
        beta: 80,
        gamma: 4,
        absolute: true,
      }),
    );

    expect(service.getSnapshot()).toMatchObject({ status: 'active', absolute: true });
    expect(statuses).toContain('active');
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({
      alphaDeg: 12,
      betaDeg: 80,
      gammaDeg: 4,
      absolute: true,
    });

    // A relative event must not overwrite an absolute reference.
    window.dispatchEvent(
      new FakeDeviceOrientationEvent('deviceorientation', {
        alpha: 100,
        beta: 70,
        gamma: 0,
        absolute: false,
      }),
    );
    expect(readings).toHaveLength(1);

    service.disable();
    expect(service.getSnapshot().status).toBe('idle');
    window.dispatchEvent(
      new FakeDeviceOrientationEvent('deviceorientationabsolute', {
        alpha: 40,
        beta: 70,
        gamma: 0,
        absolute: true,
      }),
    );
    expect(readings).toHaveLength(1);
    service.dispose();
  });

  it('uses the iOS compass heading as an absolute reference', async () => {
    installSensorConstructor(FakeDeviceOrientationEvent);
    const service = new DeviceOrientationService();
    const readings: Array<{ absolute: boolean; compassHeadingDeg: number | null }> = [];
    service.subscribeReadings((sample) =>
      readings.push({
        absolute: sample.absolute,
        compassHeadingDeg: sample.compassHeadingDeg,
      }),
    );
    await service.enable();
    window.dispatchEvent(
      new FakeDeviceOrientationEvent('deviceorientation', {
        alpha: 200,
        beta: 65,
        gamma: -10,
        absolute: false,
        webkitCompassHeading: 315,
      }),
    );
    expect(readings).toEqual([{ absolute: true, compassHeadingDeg: 315 }]);
    expect(service.getSnapshot()).toMatchObject({ status: 'active', absolute: true });
    service.dispose();
  });

  it('reports an unavailable sensor when no data arrives in time', async () => {
    installSensorConstructor(FakeDeviceOrientationEvent);
    vi.useFakeTimers();
    const service = new DeviceOrientationService();
    await service.enable();
    expect(service.getSnapshot().status).toBe('waiting');
    vi.advanceTimersByTime(3500);
    expect(service.getSnapshot().status).toBe('unavailable');
    expect(service.getSnapshot().messageFa).toContain('حسگر');
    service.dispose();
  });

  it('ignores malformed readings', async () => {
    installSensorConstructor(FakeDeviceOrientationEvent);
    const service = new DeviceOrientationService();
    const readings: unknown[] = [];
    service.subscribeReadings((sample) => readings.push(sample));
    await service.enable();
    window.dispatchEvent(new FakeDeviceOrientationEvent('deviceorientationabsolute'));
    expect(readings).toHaveLength(0);
    expect(service.getSnapshot().status).toBe('waiting');
    service.dispose();
  });
});
