import { describe, expect, it } from 'vitest';
import {
  accuracyAngularRadiusDegrees,
  accuracyCircleLocalPoints,
  assertGeoCoordinate,
  geoLocationFromManual,
  geodeticToUnitVector,
  normalizeLongitude,
  unitVectorToGeodetic,
  WGS84,
  wgs84LocalRadii,
} from './earthCoordinates';

describe('Earth geographic coordinate contract', () => {
  it('maps cardinal points into the documented local frame', () => {
    const cardinal = [
      { lat: 0, lon: 0, expected: [1, 0, 0] },
      { lat: 90, lon: 0, expected: [0, 1, 0] },
      { lat: 0, lon: 90, expected: [0, 0, -1] },
      { lat: 0, lon: 180, expected: [-1, 0, 0] },
    ] as const;
    for (const item of cardinal) {
      const vector = geodeticToUnitVector(item.lat, item.lon);
      expect(vector.x).toBeCloseTo(item.expected[0], 12);
      expect(vector.y).toBeCloseTo(item.expected[1], 12);
      expect(vector.z).toBeCloseTo(item.expected[2], 12);
    }
  });

  it('maps known geographic coordinates to the expected local position', () => {
    // Tehran: 35.6892 N, 51.3890 E
    const tehran = geodeticToUnitVector(35.6892, 51.389);
    expect(tehran.x).toBeCloseTo(0.50683, 4);
    expect(tehran.y).toBeCloseTo(0.58339, 4);
    expect(tehran.z).toBeCloseTo(-0.63465, 4);
  });

  it('round-trips through the inverse transform', () => {
    for (const coordinate of [
      { latitudeDeg: 0, longitudeDeg: 0 },
      { latitudeDeg: 35.6892, longitudeDeg: 51.389 },
      { latitudeDeg: -33.8688, longitudeDeg: 151.2093 },
      { latitudeDeg: 51.5074, longitudeDeg: -0.1278 },
      { latitudeDeg: 89.9, longitudeDeg: -179.9 },
      { latitudeDeg: -89.9, longitudeDeg: 179.9 },
    ]) {
      const vector = geodeticToUnitVector(coordinate.latitudeDeg, coordinate.longitudeDeg);
      const roundTrip = unitVectorToGeodetic(vector);
      expect(roundTrip.latitudeDeg).toBeCloseTo(coordinate.latitudeDeg, 8);
      if (Math.abs(coordinate.latitudeDeg) < 89.999) {
        expect(roundTrip.longitudeDeg).toBeCloseTo(
          normalizeLongitude(coordinate.longitudeDeg),
          8,
        );
      }
    }
  });

  it('handles longitude wrapping and rejects invalid input', () => {
    expect(normalizeLongitude(181)).toBe(-179);
    expect(normalizeLongitude(-181)).toBe(179);
    expect(normalizeLongitude(540)).toBe(180);
    expect(() => geodeticToUnitVector(91, 0)).toThrow(RangeError);
    expect(() => geodeticToUnitVector(0, Number.NaN)).toThrow(RangeError);
    expect(() => assertGeoCoordinate({ latitudeDeg: -91, longitudeDeg: 0 })).toThrow(
      RangeError,
    );
    expect(() => unitVectorToGeodetic({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
  });

  it('uses WGS84 local radii for accuracy scale', () => {
    const equator = wgs84LocalRadii(0);
    const pole = wgs84LocalRadii(90);
    expect(equator.primeVerticalM).toBeCloseTo(WGS84.semiMajorAxisM, 3);
    expect(equator.meridionalM).toBeLessThan(WGS84.semiMajorAxisM);
    expect(pole.meridionalM).toBeGreaterThan(equator.meridionalM);
    expect(equator.meanM).toBeGreaterThan(6_300_000);
    expect(accuracyAngularRadiusDegrees(0, 111_195)).toBeCloseTo(1, 1);
    expect(accuracyAngularRadiusDegrees(35.6892, 0)).toBe(0);
    expect(() => accuracyAngularRadiusDegrees(0, -1)).toThrow(RangeError);
  });

  it('creates a finite accuracy circle at the correct angular radius', () => {
    const point = { latitudeDeg: 35.6892, longitudeDeg: 51.389 };
    const points = accuracyCircleLocalPoints(point, 500, { segments: 32 });
    expect(points).toHaveLength(32);
    const center = geodeticToUnitVector(point.latitudeDeg, point.longitudeDeg);
    const expectedAngle =
      accuracyAngularRadiusDegrees(point.latitudeDeg, 500) * (Math.PI / 180);
    for (const vector of points) {
      expect(Number.isFinite(vector.x)).toBe(true);
      expect(Number.isFinite(vector.y)).toBe(true);
      expect(Number.isFinite(vector.z)).toBe(true);
      const length = Math.hypot(vector.x, vector.y, vector.z);
      expect(length).toBeCloseTo(1.00003, 8);
      const cosine =
        (vector.x * center.x + vector.y * center.y + vector.z * center.z) / length;
      expect(Math.acos(Math.min(1, Math.max(-1, cosine)))).toBeCloseTo(
        expectedAngle,
        7,
      );
    }
    expect(accuracyCircleLocalPoints(point, 0)).toEqual([]);
  });

  it('creates a valid circle at both poles', () => {
    for (const latitudeDeg of [90, -90]) {
      const points = accuracyCircleLocalPoints(
        { latitudeDeg, longitudeDeg: 0 },
        1000,
        { segments: 8 },
      );
      expect(points).toHaveLength(8);
      for (const vector of points) {
        expect(Number.isFinite(vector.x)).toBe(true);
        expect(Number.isFinite(vector.y)).toBe(true);
        expect(Number.isFinite(vector.z)).toBe(true);
      }
    }
  });

  it('creates a manual GeoLocation without inventing accuracy', () => {
    const location = geoLocationFromManual(
      { latitudeDeg: 35.6892, longitudeDeg: 51.389 },
      1200,
    );
    expect(location.source).toBe('manual');
    expect(location.accuracyM).toBeNull();
    expect(location.altitudeM).toBe(1200);
    expect(location.longitudeDeg).toBeCloseTo(51.389, 8);
  });
});
