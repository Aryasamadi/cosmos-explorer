import type { ObserverLocation } from '../types';

export type LocationField = 'latitude' | 'longitude' | 'height' | 'format';

export type ParsedLocation =
  | { ok: true; location: ObserverLocation }
  | { ok: false; field: LocationField };

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Parses a user-entered number. Accepts Persian and Arabic-Indic digits,
 * Arabic decimal separators, and grouping separators.
 */
export function parseLocaleNumber(raw: string): number | null {
  if (typeof raw !== 'string') {
    return null;
  }
  let text = raw.trim();
  if (!text) {
    return null;
  }

  text = [...text]
    .map((char) => {
      const persianIndex = PERSIAN_DIGITS.indexOf(char);
      if (persianIndex >= 0) return String(persianIndex);
      const arabicIndex = ARABIC_DIGITS.indexOf(char);
      if (arabicIndex >= 0) return String(arabicIndex);
      if (char === '٫' || char === '،') return '.';
      return char;
    })
    .join('');

  text = text.replace(/[٬\s]/g, '').replace(/,/g, '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function validateLatitude(value: number): number {
  if (!Number.isFinite(value) || value < -90 || value > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees.');
  }
  return value;
}

export function validateLongitude(value: number): number {
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    throw new RangeError('Longitude must be between -180 and 180 degrees.');
  }
  return value;
}

export function validateObserverLocation(location: ObserverLocation): ObserverLocation {
  if (!location || typeof location !== 'object') {
    throw new TypeError('Observer location is required.');
  }
  validateLatitude(location.latitudeDeg);
  validateLongitude(location.longitudeDeg);
  if (!Number.isFinite(location.heightM) || location.heightM < -500 || location.heightM > 10000) {
    throw new RangeError('Observer height is outside the supported range.');
  }
  return location;
}

export function parseLocationInput(
  latitudeText: string,
  longitudeText: string,
  heightText = '0',
): ParsedLocation {
  const latitude = parseLocaleNumber(latitudeText);
  const longitude = parseLocaleNumber(longitudeText);
  const height = heightText.trim() === '' ? 0 : parseLocaleNumber(heightText);

  if (latitude === null || longitude === null || height === null) {
    return { ok: false, field: 'format' };
  }
  if (latitude < -90 || latitude > 90) {
    return { ok: false, field: 'latitude' };
  }
  if (longitude < -180 || longitude > 180) {
    return { ok: false, field: 'longitude' };
  }
  if (height < -500 || height > 10000) {
    return { ok: false, field: 'height' };
  }

  return {
    ok: true,
    location: {
      latitudeDeg: latitude,
      longitudeDeg: longitude,
      heightM: height,
      source: 'manual',
    },
  };
}

export function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function assertValidDate(value: Date): Date {
  if (!isValidDate(value)) {
    throw new RangeError('A valid Date is required.');
  }
  return value;
}
