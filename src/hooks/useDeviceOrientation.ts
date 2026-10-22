import { useCallback, useEffect, useState } from 'react';
import {
  DeviceOrientationService,
  type SensorStatusSnapshot,
} from '../sensors/DeviceOrientationService';
import type { OrientationSample } from '../sensors/orientationMath';

export interface UseDeviceOrientationResult {
  status: SensorStatusSnapshot;
  enable: () => Promise<SensorStatusSnapshot>;
  disable: () => void;
  subscribeReadings: (listener: (sample: OrientationSample) => void) => () => void;
}

export function useDeviceOrientation(): UseDeviceOrientationResult {
  const [service] = useState(() => new DeviceOrientationService());
  const [status, setStatus] = useState<SensorStatusSnapshot>(() => service.getSnapshot());

  useEffect(() => {
    const unsubscribe = service.subscribeStatus(setStatus);
    return () => {
      unsubscribe();
      service.disable();
    };
  }, [service]);

  const enable = useCallback(() => service.enable(), [service]);
  const disable = useCallback(() => service.disable(), [service]);
  const subscribeReadings = useCallback(
    (listener: (sample: OrientationSample) => void) => service.subscribeReadings(listener),
    [service],
  );

  return { status, enable, disable, subscribeReadings };
}
