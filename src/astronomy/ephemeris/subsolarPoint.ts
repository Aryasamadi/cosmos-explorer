import { Body, Equator, Observer, SiderealTime } from 'astronomy-engine';
import { geodeticToUnitVector } from '../../geo/earthCoordinates';
import type { GeoCoordinate } from '../../geo/types';
import { normalizeSignedDegrees } from '../coordinates/angles';
import { assertValidDate } from '../validation/input';

/**
 * The subsolar point is the geodetic location where the Sun is at the zenith.
 * Coordinates are geocentric/geodetic of date; this is the correct anchor for
 * Earth's daylight terminator, independently of the device timezone.
 */
export function computeSubsolarPoint(date: Date): GeoCoordinate {
  assertValidDate(date);
  const geocentric = new Observer(0, 0, 0);
  const sun = Equator(Body.Sun, date, geocentric, true, true);
  const greenwichSiderealHours = SiderealTime(date);
  return {
    latitudeDeg: sun.dec,
    longitudeDeg: normalizeSignedDegrees(
      (sun.ra - greenwichSiderealHours) * 15,
    ),
  };
}

export function solarDotAt(
  coordinate: GeoCoordinate,
  subsolarPoint: GeoCoordinate,
): number {
  const point = geodeticToUnitVector(
    coordinate.latitudeDeg,
    coordinate.longitudeDeg,
  );
  const sun = geodeticToUnitVector(
    subsolarPoint.latitudeDeg,
    subsolarPoint.longitudeDeg,
  );
  return Math.min(1, Math.max(-1, point.x * sun.x + point.y * sun.y + point.z * sun.z));
}

/**
 * Mirrors the smoothstep used by the Earth shader so tests can verify the
 * day/night transition without a GPU.
 */
export function earthDayFactor(sunDot: number): number {
  if (!Number.isFinite(sunDot)) throw new RangeError('sunDot must be finite.');
  const t = Math.min(1, Math.max(0, (sunDot + 0.1) / 0.24));
  return t * t * (3 - 2 * t);
}

/** 1 on the night side, 0 in daylight, with a soft terminator. */
export function cityLightsVisibility(sunDot: number): number {
  if (!Number.isFinite(sunDot)) throw new RangeError('sunDot must be finite.');
  const t = Math.min(1, Math.max(0, (sunDot + 0.16) / 0.2));
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}
