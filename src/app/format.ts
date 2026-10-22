import type { BodyFact, FactDataType, FactUnit } from '../catalog/types';
import type { HorizontalCoordinates, ObserverLocation, SkyLightLevel } from '../astronomy/types';
import type { GeoCoordinate } from '../geo/types';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function toSuperscript(value: string): string {
  return value
    .split('')
    .map((character) => {
      const digit = Number(character);
      return Number.isInteger(digit)
        ? (SUPERSCRIPT_DIGITS[digit] ?? character)
        : character === '-'
          ? '⁻'
          : character;
    })
    .join('');
}

export function formatScientific(value: number, significantDigits = 4): string {
  const absolute = Math.abs(value);
  if (absolute === 0) return formatNumber(0);
  if (absolute >= 1e7 || absolute < 0.001) {
    const exponent = Math.floor(Math.log10(absolute));
    const mantissa = value / 10 ** exponent;
    return `${formatNumber(mantissa, significantDigits)} × ۱۰${toSuperscript(String(exponent))}`;
  }
  return formatNumber(value, significantDigits);
}

export const FACT_UNIT_FA: Record<FactUnit, string> = {
  km: 'کیلومتر',
  kg: 'کیلوگرم',
  'million-km': 'میلیون کیلومتر',
  day: 'روز',
  hour: 'ساعت',
  celsius: 'درجه سلسیوس',
  kelvin: 'کلوین',
  degree: 'درجه',
  'light-year': 'سال نوری',
  magnitude: 'قدر',
};

export const DATA_TYPE_FA: Record<FactDataType, string> = {
  measured: 'اندازه‌گیری‌شده',
  mean: 'میانگین',
  range: 'بازه',
  effective: 'مؤثر',
  approximate: 'تقریبی',
};

export function formatFactValue(fact: BodyFact): string {
  if (fact.kind === 'text') {
    return fact.valueFa;
  }
  const unit = FACT_UNIT_FA[fact.unit];
  const value = fact.value;
  if (typeof value === 'number') {
    const formatted =
      fact.unit === 'magnitude' ? formatNumber(value, 2) : formatScientific(value, 4);
    return `${formatted} ${unit}`;
  }
  const min =
    fact.unit === 'magnitude' ? formatNumber(value.min, 2) : formatScientific(value.min, 4);
  const max =
    fact.unit === 'magnitude' ? formatNumber(value.max, 2) : formatScientific(value.max, 4);
  return `${min} تا ${max} ${unit}`;
}

export function formatAngle(degrees: number, fractionDigits = 1): string {
  return `${formatNumber(degrees, fractionDigits)}°`;
}

const COMPASS_SECTORS = [
  'شمال',
  'شمال‌شرق',
  'شرق',
  'جنوب‌شرق',
  'جنوب',
  'جنوب‌غرب',
  'غرب',
  'شمال‌غرب',
] as const;

export function compassDirectionFa(azimuthDegrees: number): string {
  const normalized = ((azimuthDegrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_SECTORS[index] ?? 'شمال';
}

export function formatHorizontal(horizontal: HorizontalCoordinates): string {
  return `ارتفاع ${formatAngle(horizontal.altitudeDeg)}، سمت ${formatAngle(
    horizontal.azimuthDeg,
  )} (${compassDirectionFa(horizontal.azimuthDeg)})`;
}

export function formatDistanceKm(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '—';
  if (distanceKm < 1e6) {
    return `${formatNumber(distanceKm, 0)} کیلومتر`;
  }
  return `${formatScientific(distanceKm / 1e6, 4)} میلیون کیلومتر`;
}

export function formatObserverLocation(
  location: ObserverLocation | GeoCoordinate,
): string {
  const latDirection = location.latitudeDeg >= 0 ? 'شمالی' : 'جنوبی';
  const lonDirection = location.longitudeDeg >= 0 ? 'شرقی' : 'غربی';
  return `${formatAngle(Math.abs(location.latitudeDeg), 3)} ${latDirection}، ${formatAngle(
    Math.abs(location.longitudeDeg),
    3,
  )} ${lonDirection}`;
}

export function formatLocalDateTime(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

export function formatLocalTime(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatUtcDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatTimezoneName(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR', { timeZoneName: 'short' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? '';
}

export function formatAccuracy(accuracyM: number | null): string {
  if (accuracyM === null || !Number.isFinite(accuracyM)) {
    return 'شعاع دقت نامشخص';
  }
  return `شعاع دقت گزارش‌شده ±${formatNumber(accuracyM, 0)} متر`;
}

export function formatGeoSource(source: 'device' | 'manual'): string {
  return source === 'device' ? 'موقعیت دستگاه' : 'ورود دستی';
}

export const LIGHT_LEVEL_FA: Record<SkyLightLevel, string> = {
  day: 'روز',
  'civil-twilight': 'گرگ‌ومیش مدنی',
  'nautical-twilight': 'گرگ‌ومیش دریایی',
  'astronomical-twilight': 'گرگ‌ومیش نجومی',
  night: 'شب',
};

export function formatIllumination(fraction: number | null): string {
  if (fraction === null || !Number.isFinite(fraction)) return '—';
  return `${formatNumber(fraction * 100, 0)}٪`;
}

export function formatDateInputValue(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function formatBodyKind(kind: 'planet' | 'natural-satellite' | 'star'): string {
  switch (kind) {
    case 'planet':
      return 'سیاره';
    case 'natural-satellite':
      return 'قمر طبیعی';
    case 'star':
      return 'ستاره';
  }
}
