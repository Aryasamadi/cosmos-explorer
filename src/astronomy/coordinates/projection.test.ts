import { describe, expect, it } from 'vitest';
import { altAzToSkyVector, skyVectorToAltAz } from './projection';

describe('horizontal scene projection', () => {
  it('maps cardinal directions into the documented scene frame', () => {
    const north = altAzToSkyVector({ altitudeDeg: 0, azimuthDeg: 0 }, 10);
    expect(north.x).toBeCloseTo(0, 10);
    expect(north.y).toBeCloseTo(0, 10);
    expect(north.z).toBeCloseTo(-10, 10);

    const east = altAzToSkyVector({ altitudeDeg: 0, azimuthDeg: 90 }, 10);
    expect(east.x).toBeCloseTo(10, 10);
    expect(east.y).toBeCloseTo(0, 10);
    expect(east.z).toBeCloseTo(0, 10);

    const zenith = altAzToSkyVector({ altitudeDeg: 90, azimuthDeg: 123 }, 10);
    expect(zenith.x).toBeCloseTo(0, 10);
    expect(zenith.y).toBeCloseTo(10, 10);
    expect(zenith.z).toBeCloseTo(0, 10);
  });

  it('round-trips altitude and azimuth', () => {
    for (const horizontal of [
      { altitudeDeg: 0, azimuthDeg: 0 },
      { altitudeDeg: 35, azimuthDeg: 120 },
      { altitudeDeg: -55, azimuthDeg: 300 },
      { altitudeDeg: 89, azimuthDeg: 45 },
    ]) {
      const vector = altAzToSkyVector(horizontal, 160);
      const result = skyVectorToAltAz(vector);
      expect(result.altitudeDeg).toBeCloseTo(horizontal.altitudeDeg, 8);
      expect(result.azimuthDeg).toBeCloseTo(horizontal.azimuthDeg, 8);
    }
  });

  it('rejects invalid input', () => {
    expect(() => altAzToSkyVector({ altitudeDeg: 91, azimuthDeg: 0 })).toThrow(RangeError);
    expect(() => skyVectorToAltAz({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
    expect(() => skyVectorToAltAz({ x: Number.NaN, y: 1, z: 0 })).toThrow(RangeError);
  });
});
