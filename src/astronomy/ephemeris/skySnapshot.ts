import {
  Body,
  Equator,
  EquatorFromVector,
  Illumination,
  KM_PER_AU,
  Observer,
  Rotation_EQJ_EQD,
  RotateVector,
  Spherical,
  VectorFromSphere,
} from 'astronomy-engine';
import { getSkyBodies } from '../../catalog/bodies';
import type { CelestialBody } from '../../catalog/types';
import type {
  EphemerisTarget,
  EquatorialCoordinates,
  ObserverLocation,
  SkyLightLevel,
  SkyObjectPosition,
  SkySnapshot,
} from '../types';
import { normalizeDegrees, normalizeHours } from '../coordinates/angles';
import { equatorialToHorizontal, localSiderealTimeHours } from '../coordinates/horizontal';
import { assertValidDate, validateObserverLocation } from '../validation/input';

const LY_IN_KM = 9.4607304725808e12;

const ENGINE_BODIES: Record<EphemerisTarget, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mars: Body.Mars,
};

/**
 * Approximate day/twilight classification based on the geometric altitude of
 * the solar center. It ignores local terrain and weather.
 */
export function classifySkyLight(sunAltitudeDeg: number): SkyLightLevel {
  if (!Number.isFinite(sunAltitudeDeg)) {
    throw new RangeError('Sun altitude must be finite.');
  }
  if (sunAltitudeDeg >= -0.833) return 'day';
  if (sunAltitudeDeg >= -6) return 'civil-twilight';
  if (sunAltitudeDeg >= -12) return 'nautical-twilight';
  if (sunAltitudeDeg >= -18) return 'astronomical-twilight';
  return 'night';
}

function finiteOrIssue(
  value: number,
  label: string,
  bodyId: string,
  issues: string[],
): number | null {
  if (!Number.isFinite(value)) {
    issues.push(`${bodyId}: non-finite ${label} returned by the ephemeris library.`);
    return null;
  }
  return value;
}

function starApparentMagnitude(body: CelestialBody): number | null {
  for (const fact of body.facts) {
    if (fact.kind === 'quantity' && fact.id === 'apparent-magnitude') {
      return typeof fact.value === 'number' ? fact.value : null;
    }
  }
  return null;
}

function computeStarPosition(
  body: CelestialBody,
  date: Date,
  observer: ObserverLocation,
  issues: string[],
): SkyObjectPosition | null {
  const fix = body.starFix;
  if (!fix) {
    issues.push(`${body.id}: missing fixed-star coordinates.`);
    return null;
  }
  const sphere = new Spherical(
    fix.declinationDeg,
    normalizeDegrees(fix.rightAscensionHours * 15),
    1,
  );
  const vectorJ2000 = VectorFromSphere(sphere, date);
  const vectorOfDate = RotateVector(Rotation_EQJ_EQD(date), vectorJ2000);
  const ofDate = EquatorFromVector(vectorOfDate);
  const equatorial: EquatorialCoordinates = {
    raHours: normalizeHours(ofDate.ra),
    decDeg: ofDate.dec,
  };
  const horizontal = equatorialToHorizontal(equatorial, observer, date);
  if (!Number.isFinite(horizontal.altitudeDeg) || !Number.isFinite(horizontal.azimuthDeg)) {
    issues.push(`${body.id}: invalid horizontal coordinates.`);
    return null;
  }
  return {
    bodyId: body.id,
    equatorial,
    horizontal,
    distanceKm: fix.distanceLightYears * LY_IN_KM,
    isAboveHorizon: horizontal.altitudeDeg > 0,
    apparentMagnitude: starApparentMagnitude(body),
    illuminationFraction: null,
  };
}

function computeSolarSystemPosition(
  body: CelestialBody,
  engineObserver: Observer,
  date: Date,
  observer: ObserverLocation,
  issues: string[],
): SkyObjectPosition | null {
  const target = body.ephemerisTarget;
  if (!target) {
    issues.push(`${body.id}: missing ephemeris target.`);
    return null;
  }
  const engineBody = ENGINE_BODIES[target];
  const apparent = Equator(engineBody, date, engineObserver, true, true);

  const raHours = finiteOrIssue(apparent.ra, 'right ascension', body.id, issues);
  const decDeg = finiteOrIssue(apparent.dec, 'declination', body.id, issues);
  const distanceAu = finiteOrIssue(apparent.dist, 'distance', body.id, issues);
  if (raHours === null || decDeg === null || distanceAu === null) {
    return null;
  }

  const equatorial: EquatorialCoordinates = {
    raHours: normalizeHours(raHours),
    decDeg,
  };
  const horizontal = equatorialToHorizontal(equatorial, observer, date);
  if (!Number.isFinite(horizontal.altitudeDeg) || !Number.isFinite(horizontal.azimuthDeg)) {
    issues.push(`${body.id}: invalid horizontal coordinates.`);
    return null;
  }

  let apparentMagnitude: number | null = null;
  let illuminationFraction: number | null = null;
  try {
    const illumination = Illumination(engineBody, date);
    if (Number.isFinite(illumination.mag)) {
      apparentMagnitude = illumination.mag;
    }
    if (target === 'moon' && Number.isFinite(illumination.phase_fraction)) {
      illuminationFraction = illumination.phase_fraction;
    }
  } catch {
    issues.push(`${body.id}: illumination data unavailable.`);
  }

  return {
    bodyId: body.id,
    equatorial,
    horizontal,
    distanceKm: distanceAu * KM_PER_AU,
    isAboveHorizon: horizontal.altitudeDeg > 0,
    apparentMagnitude,
    illuminationFraction,
  };
}

/**
 * Computes a complete sky snapshot for the given instant and observer.
 * The caller is responsible for providing an explicitly chosen location.
 * Positions use geometric altitude (no atmospheric refraction).
 */
export function computeSkySnapshot(date: Date, observer: ObserverLocation): SkySnapshot {
  assertValidDate(date);
  validateObserverLocation(observer);

  const engineObserver = new Observer(
    observer.latitudeDeg,
    observer.longitudeDeg,
    observer.heightM,
  );
  const issues: string[] = [];
  const positions: SkyObjectPosition[] = [];

  for (const body of getSkyBodies()) {
    try {
      const position = body.starFix
        ? computeStarPosition(body, date, observer, issues)
        : computeSolarSystemPosition(body, engineObserver, date, observer, issues);
      if (position) {
        positions.push(position);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      issues.push(`${body.id}: ${reason}`);
    }
  }

  const sunPosition = positions.find((position) => position.bodyId === 'sun');
  if (!sunPosition) {
    issues.push('sun: the Sun could not be positioned; day/night state is unknown.');
  }
  const sunAltitudeDeg = sunPosition?.horizontal.altitudeDeg ?? -90;

  return {
    timestamp: new Date(date.getTime()),
    observer: { ...observer },
    positions,
    sunAltitudeDeg,
    lightLevel: classifySkyLight(sunAltitudeDeg),
    localSiderealTimeHours: localSiderealTimeHours(date, observer.longitudeDeg),
    issues,
  };
}

export function getPosition(
  snapshot: SkySnapshot,
  bodyId: string,
): SkyObjectPosition | undefined {
  return snapshot.positions.find((position) => position.bodyId === bodyId);
}
