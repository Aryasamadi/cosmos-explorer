import {
  Body,
  GeoVector,
  RotateVector,
  Rotation_EQJ_EQD,
  SiderealTime,
} from 'astronomy-engine';
import type { LocalVector } from '../geo/types';
import { assertValidDate } from './validation/input';

export type ReferenceBodyId = 'sun' | 'moon' | 'mars';

export interface BodyReferenceState {
  /** Unit direction from the Earth's center toward the body, in the local geographic frame. */
  directionFromEarth: LocalVector;
  /**
   * Unit direction from the body toward the Sun, in the same local frame.
   * For the Sun itself this equals directionFromEarth.
   */
  sunDirection: LocalVector;
  /** Geometric geocentric distance in astronomical units. */
  distanceAu: number;
}

export interface ReferenceFrame {
  timestampUtc: Date;
  sun: BodyReferenceState;
  moon: BodyReferenceState;
  mars: BodyReferenceState;
}

const DEG_TO_RAD = Math.PI / 180;
const MIN_VECTOR_LENGTH = 1e-12;

function normalize(vector: LocalVector): LocalVector {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length < MIN_VECTOR_LENGTH) {
    throw new RangeError('Ephemeris returned a degenerate direction vector.');
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

/**
 * Rotates an EQD (equator of date) vector into the displayed Earth frame.
 *
 * The geographic frame is right-handed:
 *   x = latitude 0, longitude 0
 *   y = north pole
 *   z = latitude 0, longitude 90 W
 *
 * This matches the local frame used by the sphere texture and location layer.
 */
function eqdVectorToLocal(
  vector: { x: number; y: number; z: number },
  date: Date,
): LocalVector {
  const siderealRad = SiderealTime(date) * 15 * DEG_TO_RAD;
  const cos = Math.cos(siderealRad);
  const sin = Math.sin(siderealRad);
  const ecefX = cos * vector.x + sin * vector.y;
  const ecefY = -sin * vector.x + cos * vector.y;
  const ecefZ = vector.z;
  return {
    x: ecefX,
    y: ecefZ,
    z: -ecefY,
  };
}

function lengthAu(vector: { x: number; y: number; z: number }): number {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length)) {
    throw new RangeError('Ephemeris returned a non-finite distance.');
  }
  return length;
}

function bodyToSunVector(
  sunEqd: { x: number; y: number; z: number },
  bodyEqd: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return {
    x: sunEqd.x - bodyEqd.x,
    y: sunEqd.y - bodyEqd.y,
    z: sunEqd.z - bodyEqd.z,
  };
}

/**
 * Builds the shared scientific frame for an instant.
 *
 * Positions use the geocentric apparent direction of each body. Illumination
 * uses the actual Sun direction at the body, not the Sun direction seen from
 * Earth; that distinction is significant for Mars, where a display-scale Sun
 * position cannot represent the real Sun-Mars-Earth triangle.
 */
export function computeReferenceFrame(date: Date): ReferenceFrame {
  assertValidDate(date);
  const rotation = Rotation_EQJ_EQD(date);
  const sunEqd = RotateVector(rotation, GeoVector(Body.Sun, date, false));
  const moonEqd = RotateVector(rotation, GeoVector(Body.Moon, date, false));
  const marsEqd = RotateVector(rotation, GeoVector(Body.Mars, date, false));

  const sunLocal = normalize(eqdVectorToLocal(sunEqd, date));
  const moonLocal = normalize(eqdVectorToLocal(moonEqd, date));
  const marsLocal = normalize(eqdVectorToLocal(marsEqd, date));

  return {
    timestampUtc: new Date(date.getTime()),
    sun: {
      directionFromEarth: sunLocal,
      sunDirection: sunLocal,
      distanceAu: lengthAu(sunEqd),
    },
    moon: {
      directionFromEarth: moonLocal,
      sunDirection: normalize(
        eqdVectorToLocal(bodyToSunVector(sunEqd, moonEqd), date),
      ),
      distanceAu: lengthAu(moonEqd),
    },
    mars: {
      directionFromEarth: marsLocal,
      sunDirection: normalize(
        eqdVectorToLocal(bodyToSunVector(sunEqd, marsEqd), date),
      ),
      distanceAu: lengthAu(marsEqd),
    },
  };
}

/**
 * Fraction of a spherical body's disk illuminated as seen from the Earth's
 * center. Both inputs must be unit vectors in the same frame.
 */
export function phaseFractionFromBodyState(state: BodyReferenceState): number {
  const towardSun = state.sunDirection;
  const towardEarth = {
    x: -state.directionFromEarth.x,
    y: -state.directionFromEarth.y,
    z: -state.directionFromEarth.z,
  };
  const cosine =
    towardSun.x * towardEarth.x +
    towardSun.y * towardEarth.y +
    towardSun.z * towardEarth.z;
  return Math.min(1, Math.max(0, (1 + cosine) / 2));
}
