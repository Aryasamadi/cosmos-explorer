import { describe, expect, it } from 'vitest';
import { KM_PER_AU } from 'astronomy-engine';
import { BODY_CATALOG } from '../../catalog/bodies';
import { JPL_REFERENCE_CASES } from '../../test/referencePositions';
import { classifySkyLight, computeSkySnapshot, getPosition } from './skySnapshot';

function angularDifferenceDegrees(a: number, b: number): number {
  const difference = ((a - b + 540) % 360) - 180;
  return Math.abs(difference);
}

describe('sky snapshot', () => {
  for (const reference of JPL_REFERENCE_CASES) {
    it(`matches JPL Horizons within 0.02 degrees for ${reference.label}`, () => {
      const observer = {
        latitudeDeg: reference.latitudeDeg,
        longitudeDeg: reference.longitudeDeg,
        heightM: 0,
        source: 'manual' as const,
      };
      const snapshot = computeSkySnapshot(new Date(reference.utc), observer);
      expect(snapshot.issues).toEqual([]);

      for (const bodyId of ['sun', 'moon', 'mars'] as const) {
        const position = getPosition(snapshot, bodyId);
        expect(position, `${bodyId} position`).toBeDefined();
        if (!position) continue;
        const expected = reference.bodies[bodyId];
        expect(
          angularDifferenceDegrees(position.horizontal.azimuthDeg, expected.azimuthDeg),
          `${bodyId} azimuth`,
        ).toBeLessThan(0.02);
        expect(
          Math.abs(position.horizontal.altitudeDeg - expected.altitudeDeg),
          `${bodyId} altitude`,
        ).toBeLessThan(0.02);
        expect(position.distanceKm, `${bodyId} distance`).not.toBeNull();
        const actualAu = (position.distanceKm ?? 0) / KM_PER_AU;
        expect(
          Math.abs(actualAu - expected.distanceAu) / expected.distanceAu,
          `${bodyId} relative distance`,
        ).toBeLessThan(3e-4);
        expect(position.isAboveHorizon).toBe(expected.altitudeDeg > 0);
        expect(Number.isFinite(position.equatorial.raHours)).toBe(true);
        expect(Number.isFinite(position.equatorial.decDeg)).toBe(true);
      }
    });
  }

  it('returns all catalog bodies and only finite positions', () => {
    const snapshot = computeSkySnapshot(new Date('2026-01-15T09:00:00Z'), {
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      heightM: 0,
      source: 'manual',
    });
    expect(snapshot.positions).toHaveLength(
      BODY_CATALOG.filter((body) => body.skyVisible).length,
    );
    for (const position of snapshot.positions) {
      expect(Number.isFinite(position.horizontal.altitudeDeg)).toBe(true);
      expect(Number.isFinite(position.horizontal.azimuthDeg)).toBe(true);
      expect(position.horizontal.altitudeDeg).toBeGreaterThanOrEqual(-90);
      expect(position.horizontal.altitudeDeg).toBeLessThanOrEqual(90);
      expect(position.horizontal.azimuthDeg).toBeGreaterThanOrEqual(0);
      expect(position.horizontal.azimuthDeg).toBeLessThan(360);
    }
  });

  it('places Polaris near an altitude equal to the observer latitude', () => {
    const snapshot = computeSkySnapshot(new Date('2026-01-15T21:00:00Z'), {
      latitudeDeg: 51.5,
      longitudeDeg: 0,
      heightM: 0,
      source: 'manual',
    });
    const polaris = getPosition(snapshot, 'polaris');
    expect(polaris).toBeDefined();
    // Polaris is about 0.74 degrees from the celestial pole, so its altitude
    // oscillates around the observer's latitude within roughly one degree.
    expect(Math.abs((polaris?.horizontal.altitudeDeg ?? 0) - 51.5)).toBeLessThan(1.5);
  });

  it('classifies day/twilight thresholds and below-horizon objects', () => {
    expect(classifySkyLight(10)).toBe('day');
    expect(classifySkyLight(-3)).toBe('civil-twilight');
    expect(classifySkyLight(-8)).toBe('nautical-twilight');
    expect(classifySkyLight(-15)).toBe('astronomical-twilight');
    expect(classifySkyLight(-25)).toBe('night');
    expect(() => classifySkyLight(Number.NaN)).toThrow(RangeError);

    const snapshot = computeSkySnapshot(new Date('2026-01-15T15:00:00Z'), {
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      heightM: 0,
      source: 'manual',
    });
    expect(snapshot.sunAltitudeDeg).toBeLessThan(0);
    expect(getPosition(snapshot, 'sun')?.isAboveHorizon).toBe(false);
  });

  it('is deterministic for the same observer and instant', () => {
    const observer = {
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      heightM: 0,
      source: 'manual' as const,
    };
    const date = new Date('2026-01-15T09:00:00Z');
    const first = computeSkySnapshot(date, observer);
    const second = computeSkySnapshot(date, observer);
    expect(second.positions).toEqual(first.positions);
    expect(second.sunAltitudeDeg).toBe(first.sunAltitudeDeg);
    expect(second.lightLevel).toBe(first.lightLevel);
  });

  it('rejects invalid observers and dates', () => {
    expect(() =>
      computeSkySnapshot(new Date('invalid'), {
        latitudeDeg: 0,
        longitudeDeg: 0,
        heightM: 0,
        source: 'manual',
      }),
    ).toThrow(RangeError);
    expect(() =>
      computeSkySnapshot(new Date(), {
        latitudeDeg: 100,
        longitudeDeg: 0,
        heightM: 0,
        source: 'manual',
      }),
    ).toThrow(RangeError);
  });
});
