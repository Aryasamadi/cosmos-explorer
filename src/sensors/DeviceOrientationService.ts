import type { OrientationSample } from './orientationMath';
import { screenAngleDegrees } from './orientationMath';

export type SensorStatus =
  | 'idle'
  | 'requesting'
  | 'waiting'
  | 'active'
  | 'denied'
  | 'unsupported'
  | 'unavailable'
  | 'error';

export interface SensorStatusSnapshot {
  status: SensorStatus;
  /** True only when readings are referenced to true north. */
  absolute: boolean;
  messageFa?: string;
}

type SensorEvent = Event & {
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  absolute?: boolean;
  webkitCompassHeading?: number;
};

type PermissionCapableConstructor = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const EVENT_TIMEOUT_MS = 3500;

function isRequestable(value: unknown): value is PermissionCapableConstructor {
  return typeof value === 'function';
}

export class DeviceOrientationService {
  private status: SensorStatus = 'idle';
  private absolute = false;
  private messageFa: string | undefined;
  private lastSample: OrientationSample | null = null;
  private readonly statusListeners = new Set<(snapshot: SensorStatusSnapshot) => void>();
  private readonly readingListeners = new Set<(sample: OrientationSample) => void>();
  private eventTimeout: ReturnType<typeof setTimeout> | null = null;
  private resumeTimeout: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private hasAbsoluteReading = false;

  constructor(
    private readonly windowObject: Window = window,
    private readonly documentObject: Document = window.document,
  ) {}

  getSnapshot(): SensorStatusSnapshot {
    return { status: this.status, absolute: this.absolute, messageFa: this.messageFa };
  }

  getLastSample(): OrientationSample | null {
    return this.lastSample;
  }

  subscribeStatus(listener: (snapshot: SensorStatusSnapshot) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  subscribeReadings(listener: (sample: OrientationSample) => void): () => void {
    this.readingListeners.add(listener);
    return () => this.readingListeners.delete(listener);
  }

  async enable(): Promise<SensorStatusSnapshot> {
    if (this.status === 'active' || this.status === 'waiting' || this.status === 'requesting') {
      return this.getSnapshot();
    }

    const constructorValue = (this.windowObject as unknown as { DeviceOrientationEvent?: unknown })
      .DeviceOrientationEvent;
    if (typeof constructorValue !== 'function') {
      this.setStatus(
        'unsupported',
        false,
        'این مرورگر از رویداد جهت‌یابی دستگاه پشتیبانی نمی‌کند.',
      );
      return this.getSnapshot();
    }

    this.setStatus('requesting', false, undefined);
    if (isRequestable(constructorValue) && typeof constructorValue.requestPermission === 'function') {
      try {
        const permission = await constructorValue.requestPermission();
        if (permission !== 'granted') {
          this.setStatus(
            'denied',
            false,
            'اجازهٔ دسترسی به حسگرهای جهت‌یابی داده نشد. حالت چرخش آزاد همچنان در دسترس است.',
          );
          return this.getSnapshot();
        }
      } catch {
        this.setStatus(
          'denied',
          false,
          'درخواست اجازهٔ حسگر ناموفق یا رد شد. حالت چرخش آزاد همچنان در دسترس است.',
        );
        return this.getSnapshot();
      }
    }

    this.attachListeners();
    this.setStatus(
      'waiting',
      false,
      'اجازه داده شد؛ در انتظار نخستین دادهٔ حسگر… اگر داده‌ای نرسد، چرخش آزاد را انتخاب کنید.',
    );
    this.startEventTimeout();
    return this.getSnapshot();
  }

  disable(): void {
    this.detachListeners();
    this.clearTimers();
    this.listening = false;
    this.hasAbsoluteReading = false;
    this.lastSample = null;
    this.absolute = false;
    this.setStatus('idle', false, undefined);
  }

  dispose(): void {
    this.disable();
    this.statusListeners.clear();
    this.readingListeners.clear();
  }

  private setStatus(status: SensorStatus, absolute: boolean, messageFa: string | undefined): void {
    this.status = status;
    this.absolute = absolute;
    this.messageFa = messageFa;
    const snapshot = this.getSnapshot();
    for (const listener of this.statusListeners) {
      listener(snapshot);
    }
  }

  private attachListeners(): void {
    if (this.listening) return;
    this.listening = true;
    this.windowObject.addEventListener('deviceorientationabsolute', this.handleOrientation as EventListener);
    this.windowObject.addEventListener('deviceorientation', this.handleOrientation as EventListener);
    this.windowObject.addEventListener('orientationchange', this.handleScreenChange);
    this.windowObject.screen?.orientation?.addEventListener('change', this.handleScreenChange);
    this.documentObject.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private detachListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    this.windowObject.removeEventListener('deviceorientationabsolute', this.handleOrientation as EventListener);
    this.windowObject.removeEventListener('deviceorientation', this.handleOrientation as EventListener);
    this.windowObject.removeEventListener('orientationchange', this.handleScreenChange);
    this.windowObject.screen?.orientation?.removeEventListener('change', this.handleScreenChange);
    this.documentObject.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private startEventTimeout(): void {
    this.clearEventTimeout();
    this.eventTimeout = setTimeout(() => {
      if (this.status === 'waiting') {
        this.setStatus(
          'unavailable',
          false,
          'دادهٔ حسگر دریافت نشد. ممکن است دستگاه حسگر نداشته باشد یا مرورگر آن را محدود کرده باشد. از چرخش آزاد استفاده کنید.',
        );
      }
    }, EVENT_TIMEOUT_MS);
  }

  private clearEventTimeout(): void {
    if (this.eventTimeout !== null) {
      clearTimeout(this.eventTimeout);
      this.eventTimeout = null;
    }
  }

  private clearTimers(): void {
    this.clearEventTimeout();
    if (this.resumeTimeout !== null) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }
  }

  private emitSample(sample: OrientationSample): void {
    this.lastSample = sample;
    for (const listener of this.readingListeners) {
      listener(sample);
    }
  }

  private readonly handleOrientation = (event: Event): void => {
    const sensorEvent = event as SensorEvent;
    const alpha = sensorEvent.alpha;
    const beta = sensorEvent.beta;
    const gamma = sensorEvent.gamma;
    if (!Number.isFinite(alpha) || !Number.isFinite(beta) || !Number.isFinite(gamma)) {
      return;
    }

    const compassHeading =
      typeof sensorEvent.webkitCompassHeading === 'number' &&
      Number.isFinite(sensorEvent.webkitCompassHeading)
        ? sensorEvent.webkitCompassHeading
        : null;
    const absolute =
      sensorEvent.absolute === true ||
      event.type === 'deviceorientationabsolute' ||
      compassHeading !== null;

    if (this.hasAbsoluteReading && !absolute) {
      return;
    }
    if (absolute) {
      this.hasAbsoluteReading = true;
    }

    this.clearEventTimeout();
    if (this.resumeTimeout !== null) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    const sample: OrientationSample = {
      alphaDeg: alpha as number,
      betaDeg: beta as number,
      gammaDeg: gamma as number,
      screenAngleDeg: screenAngleDegrees(this.windowObject.screen),
      absolute,
      compassHeadingDeg: compassHeading,
      timestampMs: Date.now(),
    };

    if (this.status !== 'active' || this.absolute !== absolute) {
      this.setStatus(
        'active',
        absolute,
        absolute
          ? undefined
          : 'حسگر فعال است، اما مرجع آن شمال حقیقی نیست. برای هماهنگی، از کالیبراسیون دستی استفاده کنید.',
      );
    }
    this.emitSample(sample);
  };

  private readonly handleScreenChange = (): void => {
    const sample = this.lastSample;
    if (!sample) return;
    const angle = screenAngleDegrees(this.windowObject.screen);
    if (angle === sample.screenAngleDeg) return;
    const updated: OrientationSample = { ...sample, screenAngleDeg: angle, timestampMs: Date.now() };
    this.emitSample(updated);
  };

  private readonly handleVisibilityChange = (): void => {
    if (this.documentObject.hidden) {
      if (this.resumeTimeout !== null) {
        clearTimeout(this.resumeTimeout);
        this.resumeTimeout = null;
      }
      return;
    }
    if (this.status !== 'active') return;
    if (this.resumeTimeout !== null) clearTimeout(this.resumeTimeout);
    this.resumeTimeout = setTimeout(() => {
      this.resumeTimeout = null;
      if (this.status === 'active') {
        this.setStatus(
          'unavailable',
          this.absolute,
          'پس از بازگشت از پس‌زمینه، دادهٔ تازه‌ای از حسگر نرسید. چرخش آزاد را امتحان کنید.',
        );
      }
    }, EVENT_TIMEOUT_MS);
  };
}
