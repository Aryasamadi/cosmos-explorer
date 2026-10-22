export interface EquatorialCoordinates {
  /** Right ascension in sidereal hours, [0, 24). */
  raHours: number;
  /** Declination in degrees, [-90, 90]. Positive is north. */
  decDeg: number;
}

export interface HorizontalCoordinates {
  /** Geometric altitude in degrees, [-90, 90]. Positive is above the horizon. */
  altitudeDeg: number;
  /** Azimuth in degrees measured clockwise from north, [0, 360). East = 90. */
  azimuthDeg: number;
}

export type ObserverSource = 'geolocation' | 'manual';

export interface ObserverLocation {
  latitudeDeg: number;
  longitudeDeg: number;
  heightM: number;
  source: ObserverSource;
  /** Reported horizontal accuracy of a geolocation fix, in meters. */
  accuracyM?: number;
}

export type EphemerisTarget = 'sun' | 'moon' | 'mars';

export interface StarFix {
  rightAscensionHours: number;
  declinationDeg: number;
  distanceLightYears: number;
}

export interface SkyObjectPosition {
  bodyId: string;
  equatorial: EquatorialCoordinates;
  horizontal: HorizontalCoordinates;
  distanceKm: number | null;
  isAboveHorizon: boolean;
  apparentMagnitude: number | null;
  illuminationFraction: number | null;
}

export interface SkySnapshot {
  timestamp: Date;
  observer: ObserverLocation;
  positions: SkyObjectPosition[];
  sunAltitudeDeg: number;
  lightLevel: SkyLightLevel;
  localSiderealTimeHours: number;
  issues: string[];
}

export type SkyLightLevel =
  | 'day'
  | 'civil-twilight'
  | 'nautical-twilight'
  | 'astronomical-twilight'
  | 'night';
