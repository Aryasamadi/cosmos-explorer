import { describe, expect, it } from 'vitest';
import {
  clampCameraDistance,
  computeEarthNavigationSensitivity,
} from './earthNavigation';

describe('altitude-aware Earth navigation', () => {
  it('reduces rotation sensitivity monotonically near the surface', () => {
    const altitudes = [7.4, 3, 1.5, 1.2, 1.08, 1.02, 1.001];
    const values = altitudes.map(
      (distance) => computeEarthNavigationSensitivity(distance, 52).rotateSpeed,
    );
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]!).toBeLessThan(values[index - 1]!);
    }
    expect(values[0]).toBeLessThanOrEqual(0.3);
    expect(values.at(-1)).toBeGreaterThan(0);
  });

  it('reduces dolly sensitivity near the surface without freezing it', () => {
    const far = computeEarthNavigationSensitivity(7.4, 52);
    const near = computeEarthNavigationSensitivity(1.08, 52);
    const veryNear = computeEarthNavigationSensitivity(1.001, 52);
    expect(near.zoomSpeed).toBeLessThan(far.zoomSpeed);
    expect(veryNear.zoomSpeed).toBeLessThan(near.zoomSpeed);
    expect(veryNear.zoomSpeed).toBeGreaterThanOrEqual(0.22);
  });

  it('uses the visible surface extent for the rotation curve', () => {
    const close = computeEarthNavigationSensitivity(1.08, 52);
    const far = computeEarthNavigationSensitivity(7.4, 52);
    expect(close.visibleExtentDeg).toBeLessThan(10);
    expect(far.visibleExtentDeg).toBeGreaterThan(close.visibleExtentDeg);
    expect(close.rotateSpeed).toBeLessThan(far.rotateSpeed);
  });

  it('clamps the camera to the Earth collision boundary', () => {
    expect(clampCameraDistance(0.4, 1.0006)).toBe(1.0006);
    expect(clampCameraDistance(1.5, 1.0006)).toBe(1.5);
    expect(clampCameraDistance(1.0006, 1.0006)).toBe(1.0006);
  });

  it('rejects impossible inputs', () => {
    expect(() => computeEarthNavigationSensitivity(1, 52)).toThrow(RangeError);
    expect(() => computeEarthNavigationSensitivity(2, 0)).toThrow(RangeError);
    expect(() => computeEarthNavigationSensitivity(2, Number.NaN)).toThrow(RangeError);
    expect(() => clampCameraDistance(Number.NaN, 1)).toThrow(RangeError);
  });
});
