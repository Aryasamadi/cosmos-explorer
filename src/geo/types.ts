export interface GeoCoordinate {
  latitudeDeg: number;
  longitudeDeg: number;
}

export type GeoLocationSource = 'device' | 'manual';

/**
 * A geographic position used by the Earth layer.
 *
 * accuracyM is the radius reported by the device, not a guarantee that the
 * true position lies inside that radius.
 */
export interface GeoLocation extends GeoCoordinate {
  accuracyM: number | null;
  altitudeM: number | null;
  source: GeoLocationSource;
  timestampMs: number;
}

export interface LocalVector {
  /** East direction at the texture's prime meridian. */
  x: number;
  /** North polar axis. */
  y: number;
  /** Toward 90 degrees east longitude (negative z). */
  z: number;
}
