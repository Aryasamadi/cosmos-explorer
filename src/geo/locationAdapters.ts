import type { ObserverLocation } from '../astronomy/types';
import type { GeoLocation } from './types';

export function geoLocationToObserver(location: GeoLocation): ObserverLocation {
  return {
    latitudeDeg: location.latitudeDeg,
    longitudeDeg: location.longitudeDeg,
    heightM:
      location.altitudeM !== null && Number.isFinite(location.altitudeM)
        ? location.altitudeM
        : 0,
    source: location.source === 'device' ? 'geolocation' : 'manual',
    ...(location.accuracyM !== null ? { accuracyM: location.accuracyM } : {}),
  };
}

export function observerLocationToGeo(
  location: ObserverLocation,
  timestampMs = Date.now(),
): GeoLocation {
  return {
    latitudeDeg: location.latitudeDeg,
    longitudeDeg: location.longitudeDeg,
    accuracyM:
      location.accuracyM !== undefined && Number.isFinite(location.accuracyM)
        ? location.accuracyM
        : null,
    altitudeM: Number.isFinite(location.heightM) ? location.heightM : null,
    source: location.source === 'geolocation' ? 'device' : 'manual',
    timestampMs,
  };
}
