import { describe, expect, it } from 'vitest';
import { SiderealTime } from 'astronomy-engine';
import type { ObserverLocation } from '../types';
import {
  equatorialToHorizontal,
  localSiderealTimeHours,
} from './horizontal';

const equinoxObserver: ObserverLocation = {
  latitudeDeg: 0,
  longitudeDeg: 0,
  heightM: 0,
  source: 'manual',
};
const date = new Date('2026-01-15T09:00:00Z');

describe('equatorial to horizontal conversion', () => {
  it('computes local sidereal time consistently with the ephemeris library', () => {
    const greenwich = SiderealTime(date);
    expect(localSiderealTimeHours(date, 0)).toBeCloseTo(greenwich, 10);
    expect(localSiderealTimeHours(date, 51.389)).toBeCloseTo(
      (greenwich + 51.389 / 15) % 24,
      10,
    );
  });

  it('places a meridian object south of the zenith in the northern hemisphere', () => {
    const observer: ObserverLocation = {
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      heightM: 0,
      source: 'manual',
    };
    const ra = localSiderealTimeHours(date, observer.longitudeDeg);
    const horizontal = equatorialToHorizontal(
      { raHours: ra, decDeg: 0 },
      observer,
      date,
    );
    expect(horizontal.altitudeDeg).toBeCloseTo(90 - 35.6892, 6);
    expect(horizontal.azimuthDeg).toBeCloseTo(180, 6);
  });

  it('places a rising equatorial object due east', () => {
    const ra = (localSiderealTimeHours(date, 0) + 6) % 24;
    const horizontal = equatorialToHorizontal(
      { raHours: ra, decDeg: 0 },
      equinoxObserver,
      date,
    );
    expect(horizontal.altitudeDeg).toBeCloseTo(0, 6);
    expect(horizontal.azimuthDeg).toBeCloseTo(90, 6);
  });

  it('keeps azimuth and altitude inside their contracts', () => {
    const horizontal = equatorialToHorizontal(
      { raHours: 18.615649, decDeg: 38.783689 },
      {
        latitudeDeg: 35.6892,
        longitudeDeg: 51.389,
        heightM: 1200,
        source: 'manual',
      },
      date,
    );
    expect(horizontal.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(horizontal.azimuthDeg).toBeLessThan(360);
    expect(horizontal.altitudeDeg).toBeGreaterThanOrEqual(-90);
    expect(horizontal.altitudeDeg).toBeLessThanOrEqual(90);
  });

  it('rejects invalid coordinates instead of producing NaN', () => {
    expect(() =>
      equatorialToHorizontal({ raHours: 12, decDeg: 91 }, equinoxObserver, date),
    ).toThrow(RangeError);
    expect(() =>
      equatorialToHorizontal({ raHours: Number.NaN, decDeg: 0 }, equinoxObserver, date),
    ).toThrow(RangeError);
  });
});
