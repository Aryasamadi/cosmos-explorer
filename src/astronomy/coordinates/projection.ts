import type { HorizontalCoordinates } from '../types';
import { normalizeDegrees, RAD_TO_DEG } from './angles';

export interface SkyVector {
  /** East, in scene units. */
  x: number;
  /** Up (zenith), in scene units. */
  y: number;
  /** South, in scene units. North is -z. */
  z: number;
}

/**
 * Scene convention: +X = east, +Y = zenith, -Z = north. A three.js camera
 * at the origin with an identity rotation therefore looks due north.
 */
export function altAzToSkyVector(horizontal: HorizontalCoordinates, radius = 1): SkyVector {
  if (
    !Number.isFinite(horizontal.altitudeDeg) ||
    !Number.isFinite(horizontal.azimuthDeg) ||
    horizontal.altitudeDeg < -90 ||
    horizontal.altitudeDeg > 90 ||
    radius <= 0 ||
    !Number.isFinite(radius)
  ) {
    throw new RangeError('Horizontal coordinates or radius are invalid.');
  }
  const altitude = horizontal.altitudeDeg / RAD_TO_DEG;
  const azimuth = normalizeDegrees(horizontal.azimuthDeg) / RAD_TO_DEG;
  const horizontalLength = Math.cos(altitude) * radius;
  return {
    x: horizontalLength * Math.sin(azimuth),
    y: Math.sin(altitude) * radius,
    z: -horizontalLength * Math.cos(azimuth),
  };
}

export function skyVectorToAltAz(vector: SkyVector): HorizontalCoordinates {
  const { x, y, z } = vector;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new RangeError('Sky vector is invalid.');
  }
  const length = Math.hypot(x, y, z);
  if (length < 1e-12) {
    throw new RangeError('Sky vector must not be the zero vector.');
  }
  const altitude = Math.asin(y / length) * RAD_TO_DEG;
  const azimuth = normalizeDegrees(Math.atan2(x, -z) * RAD_TO_DEG);
  return { altitudeDeg: altitude, azimuthDeg: azimuth };
}
