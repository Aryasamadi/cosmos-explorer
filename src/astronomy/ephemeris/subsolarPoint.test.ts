import { describe, expect, it } from 'vitest';
import {
  cityLightsVisibility,
  computeSubsolarPoint,
  earthDayFactor,
  solarDotAt,
} from './subsolarPoint';

function longitudeDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

describe('Earth subsolar point and UTC illumination', () => {
  it('places the subsolar point at the expected latitude at equinoxes and solstices', () => {
    const march = computeSubsolarPoint(new Date('2026-03-20T12:00:00Z'));
    const june = computeSubsolarPoint(new Date('2026-06-21T12:00:00Z'));
    const december = computeSubsolarPoint(new Date('2026-12-21T12:00:00Z'));

    expect(Math.abs(march.latitudeDeg)).toBeLessThan(0.5);
    expect(june.latitudeDeg).toBeCloseTo(23.44, 1);
    expect(december.latitudeDeg).toBeCloseTo(-23.44, 1);
    // At 12:00 UTC the subsolar meridian is near Greenwich (equation of time
    // shifts it by a couple of degrees).
    expect(Math.abs(march.longitudeDeg)).toBeLessThan(4);
    expect(Math.abs(june.longitudeDeg)).toBeLessThan(4);
    expect(Math.abs(december.longitudeDeg)).toBeLessThan(4);
  });

  it('moves the subsolar longitude by roughly half a turn over 12 UTC hours', () => {
    const midnight = computeSubsolarPoint(new Date('2026-06-21T00:00:00Z'));
    const noon = computeSubsolarPoint(new Date('2026-06-21T12:00:00Z'));
    expect(longitudeDifference(midnight.longitudeDeg, noon.longitudeDeg)).toBeCloseTo(
      180,
      0,
    );
  });

  it('uses UTC, not the process or device timezone', () => {
    const date = new Date('2026-01-15T09:00:00Z');
    const point = computeSubsolarPoint(date);
    // At 09:00 UTC the subsolar meridian is roughly 45 E, regardless of the
    // local timezone of the machine running the test.
    expect(point.longitudeDeg).toBeGreaterThan(38);
    expect(point.longitudeDeg).toBeLessThan(56);
    expect(point.latitudeDeg).toBeCloseTo(-21.1, 0);
  });

  it('gives a solar dot of +1 at the subsolar point and -1 at its antipode', () => {
    const subsolar = computeSubsolarPoint(new Date('2026-06-21T12:00:00Z'));
    const day = solarDotAt(subsolar, subsolar);
    expect(day).toBeCloseTo(1, 6);
    const antipode = {
      latitudeDeg: -subsolar.latitudeDeg,
      longitudeDeg: subsolar.longitudeDeg > 0
        ? subsolar.longitudeDeg - 180
        : subsolar.longitudeDeg + 180,
    };
    const night = solarDotAt(antipode, subsolar);
    expect(night).toBeCloseTo(-1, 6);
  });

  it('suppresses city lights in daylight and keeps the night side visible', () => {
    expect(earthDayFactor(0.8)).toBeCloseTo(1, 5);
    expect(earthDayFactor(-0.8)).toBeCloseTo(0, 5);
    expect(cityLightsVisibility(0.8)).toBe(0);
    expect(cityLightsVisibility(-0.8)).toBeCloseTo(1, 5);
    expect(cityLightsVisibility(0)).toBeGreaterThan(0);
    expect(cityLightsVisibility(0)).toBeLessThan(1);
    expect(() => earthDayFactor(Number.NaN)).toThrow(RangeError);
  });

  it('rejects invalid dates', () => {
    expect(() => computeSubsolarPoint(new Date('invalid'))).toThrow(RangeError);
  });
});
