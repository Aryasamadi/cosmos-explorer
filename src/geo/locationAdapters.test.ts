import { describe, expect, it } from 'vitest';
import { geoLocationToObserver, observerLocationToGeo } from './locationAdapters';

describe('shared location adapters', () => {
  it('maps a device GeoLocation into an ObserverLocation', () => {
    expect(
      geoLocationToObserver({
        latitudeDeg: 30.0444,
        longitudeDeg: 31.2357,
        accuracyM: 900,
        altitudeM: 25,
        source: 'device',
        timestampMs: 1_760_000_000_000,
      }),
    ).toEqual({
      latitudeDeg: 30.0444,
      longitudeDeg: 31.2357,
      heightM: 25,
      source: 'geolocation',
      accuracyM: 900,
    });
  });

  it('maps manual and null-altitude values without inventing accuracy', () => {
    const observer = geoLocationToObserver({
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      accuracyM: null,
      altitudeM: null,
      source: 'manual',
      timestampMs: 1_760_000_000_000,
    });
    expect(observer).toEqual({
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      heightM: 0,
      source: 'manual',
    });
    expect(
      observerLocationToGeo(observer, 1_760_000_000_000),
    ).toEqual({
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      accuracyM: null,
      altitudeM: 0,
      source: 'manual',
      timestampMs: 1_760_000_000_000,
    });
  });
});
