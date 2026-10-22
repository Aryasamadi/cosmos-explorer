import type { GeoCoordinate, GeoLocation, LocalVector } from './types';

/**
 * Coordinate contract for the displayed Earth sphere:
 *
 *   local = (cos(lat) cos(lon), sin(lat), -cos(lat) sin(lon))
 *
 * +X is 0 degrees longitude, +Y is the north pole, and -Z is 90 degrees east.
 * This matches three.js SphereGeometry's UV mapping when the texture is a
 * standard equirectangular map (u = 0 at 180 W, u = 0.5 at 0).
 *
 * The displayed Earth is a sphere. WGS84 constants are used for local scale
 * and accuracy circles; they are not used to reshape the sphere into an
 * ellipsoid.
 */
export const DISPLAY_EARTH_RADIUS = 1;
export const EARTH_MEAN_RADIUS_M = 6371008.8;

export const WGS84 = {
  semiMajorAxisM: 6378137,
  flattening: 1 / 298.257223563,
} as const;

const WGS84_E2 = WGS84.flattening * (2 - WGS84.flattening);
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function normalizeLongitude(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new RangeError('Longitude must be finite.');
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 && degrees > 0 ? 180 : wrapped;
}

export function assertGeoCoordinate(coordinate: GeoCoordinate): GeoCoordinate {
  const { latitudeDeg, longitudeDeg } = coordinate;
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees.');
  }
  if (!Number.isFinite(longitudeDeg)) {
    throw new RangeError('Longitude must be finite.');
  }
  return coordinate;
}

/** Maps a geodetic coordinate to the local frame of the displayed sphere. */
export function geodeticToUnitVector(
  latitudeDeg: number,
  longitudeDeg: number,
): LocalVector {
  assertGeoCoordinate({ latitudeDeg, longitudeDeg });
  const latitude = latitudeDeg * DEG_TO_RAD;
  const longitude = normalizeLongitude(longitudeDeg) * DEG_TO_RAD;
  const cosLatitude = Math.cos(latitude);
  return {
    x: cosLatitude * Math.cos(longitude),
    y: Math.sin(latitude),
    z: -cosLatitude * Math.sin(longitude),
  };
}

export function unitVectorToGeodetic(vector: LocalVector): GeoCoordinate {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length < 1e-12) {
    throw new RangeError('Local vector must be non-zero and finite.');
  }
  const latitude = Math.asin(Math.min(1, Math.max(-1, vector.y / length))) * RAD_TO_DEG;
  const longitude =
    Math.abs(Math.cos(latitude * DEG_TO_RAD)) < 1e-12
      ? 0
      : normalizeLongitude(Math.atan2(-vector.z, vector.x) * RAD_TO_DEG);
  return { latitudeDeg: latitude, longitudeDeg: longitude };
}

export interface Wgs84LocalRadii {
  meridionalM: number;
  primeVerticalM: number;
  meanM: number;
}

/** WGS84 local radii of curvature, used to translate meters into an angle. */
export function wgs84LocalRadii(latitudeDeg: number): Wgs84LocalRadii {
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees.');
  }
  const sinLatitude = Math.sin(latitudeDeg * DEG_TO_RAD);
  const denominator = Math.sqrt(1 - WGS84_E2 * sinLatitude * sinLatitude);
  const primeVerticalM = WGS84.semiMajorAxisM / denominator;
  const meridionalM =
    (WGS84.semiMajorAxisM * (1 - WGS84_E2)) / (denominator * denominator * denominator);
  return {
    meridionalM,
    primeVerticalM,
    meanM: Math.sqrt(meridionalM * primeVerticalM),
  };
}

/**
 * Converts a reported horizontal accuracy radius to a great-circle angle on
 * the display sphere. This is an approximation: device accuracy is a
 * statistical radius, not a hard boundary, and the display is spherical.
 */
export function accuracyAngularRadiusDegrees(
  latitudeDeg: number,
  accuracyMeters: number,
): number {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    throw new RangeError('Accuracy must be a non-negative finite number.');
  }
  if (accuracyMeters === 0) return 0;
  const { meanM } = wgs84LocalRadii(latitudeDeg);
  return (accuracyMeters / meanM) * RAD_TO_DEG;
}

/**
 * Returns a closed circle on the display sphere around a coordinate.
 * The points are local-frame vectors at the requested radius.
 */
export function accuracyCircleLocalPoints(
  coordinate: GeoCoordinate,
  accuracyMeters: number,
  options: { segments?: number; radius?: number } = {},
): LocalVector[] {
  const segments = options.segments ?? 64;
  const radius = options.radius ?? 1.00003;
  if (!Number.isInteger(segments) || segments < 8 || segments > 256) {
    throw new RangeError('segments must be an integer between 8 and 256.');
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('radius must be positive and finite.');
  }
  const angularRadius = accuracyAngularRadiusDegrees(
    coordinate.latitudeDeg,
    accuracyMeters,
  ) * DEG_TO_RAD;
  if (angularRadius === 0) return [];

  const center = geodeticToUnitVector(coordinate.latitudeDeg, coordinate.longitudeDeg);
  const northAxis: LocalVector = { x: 0, y: 1, z: 0 };
  let east: LocalVector = {
    x: center.z * northAxis.y - center.y * northAxis.z,
    y: center.x * northAxis.z - center.z * northAxis.x,
    z: center.y * northAxis.x - center.x * northAxis.y,
  };
  let eastLength = Math.hypot(east.x, east.y, east.z);
  if (eastLength < 1e-9) {
    east = { x: 1, y: 0, z: 0 };
    eastLength = 1;
  }
  east = { x: east.x / eastLength, y: east.y / eastLength, z: east.z / eastLength };
  const north: LocalVector = {
    x: center.y * east.z - center.z * east.y,
    y: center.z * east.x - center.x * east.z,
    z: center.x * east.y - center.y * east.x,
  };

  const cosRadius = Math.cos(angularRadius);
  const sinRadius = Math.sin(angularRadius);
  const points: LocalVector[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const tangentX = Math.cos(angle) * north.x + Math.sin(angle) * east.x;
    const tangentY = Math.cos(angle) * north.y + Math.sin(angle) * east.y;
    const tangentZ = Math.cos(angle) * north.z + Math.sin(angle) * east.z;
    points.push({
      x: (center.x * cosRadius + tangentX * sinRadius) * radius,
      y: (center.y * cosRadius + tangentY * sinRadius) * radius,
      z: (center.z * cosRadius + tangentZ * sinRadius) * radius,
    });
  }
  return points;
}

export function geoLocationFromManual(
  coordinate: GeoCoordinate,
  altitudeM: number | null = null,
): GeoLocation {
  assertGeoCoordinate(coordinate);
  return {
    latitudeDeg: coordinate.latitudeDeg,
    longitudeDeg: normalizeLongitude(coordinate.longitudeDeg),
    accuracyM: null,
    altitudeM,
    source: 'manual',
    timestampMs: Date.now(),
  };
}
