import { SiderealTime } from 'astronomy-engine';
import type {
  EquatorialCoordinates,
  HorizontalCoordinates,
  ObserverLocation,
} from '../types';
import { validateObserverLocation } from '../validation/input';
import { assertValidDate } from '../validation/input';
import {
  clamp,
  DEG_TO_RAD,
  normalizeDegrees,
  normalizeHours,
  normalizeSignedDegrees,
  RAD_TO_DEG,
} from './angles';

/**
 * Greenwich apparent sidereal time plus east longitude, in sidereal hours.
 * The result is normalized to [0, 24).
 */
export function localSiderealTimeHours(date: Date, longitudeDeg: number): number {
  assertValidDate(date);
  const greenwich = SiderealTime(date);
  return normalizeHours(greenwich + longitudeDeg / 15);
}

/**
 * Converts equatorial coordinates of date into geometric horizontal
 * coordinates for an observer. No atmospheric refraction is applied.
 *
 * Coordinate contract:
 * - azimuth is measured clockwise from true north (north = 0, east = 90).
 * - altitude is positive above the geometric horizon.
 * - if the object is exactly at the zenith, azimuth is reported as 0.
 */
export function equatorialToHorizontal(
  equatorial: EquatorialCoordinates,
  observer: ObserverLocation,
  date: Date,
): HorizontalCoordinates {
  validateObserverLocation(observer);
  assertValidDate(date);
  if (
    !Number.isFinite(equatorial.raHours) ||
    !Number.isFinite(equatorial.decDeg) ||
    equatorial.decDeg < -90 ||
    equatorial.decDeg > 90
  ) {
    throw new RangeError('Equatorial coordinates are invalid.');
  }

  const latitude = observer.latitudeDeg * DEG_TO_RAD;
  const declination = equatorial.decDeg * DEG_TO_RAD;
  const lst = localSiderealTimeHours(date, observer.longitudeDeg);
  const hourAngle = normalizeSignedDegrees((lst - equatorial.raHours) * 15) * DEG_TO_RAD;

  const sinAltitude =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const altitudeRad = Math.asin(clamp(sinAltitude, -1, 1));

  const cosAltitude = Math.cos(altitudeRad);
  if (Math.abs(cosAltitude) < 1e-12) {
    return { altitudeDeg: altitudeRad * RAD_TO_DEG, azimuthDeg: 0 };
  }

  const azimuthRad = Math.atan2(
    -Math.sin(hourAngle),
    Math.tan(declination) * Math.cos(latitude) -
      Math.sin(latitude) * Math.cos(hourAngle),
  );

  return {
    altitudeDeg: altitudeRad * RAD_TO_DEG,
    azimuthDeg: normalizeDegrees(azimuthRad * RAD_TO_DEG),
  };
}
