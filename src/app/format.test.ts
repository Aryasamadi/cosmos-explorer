import { describe, expect, it } from 'vitest';
import { getBodyById } from '../catalog/bodies';
import type { BodyFact } from '../catalog/types';
import {
  compassDirectionFa,
  formatAngle,
  formatDistanceKm,
  formatFactValue,
  formatIllumination,
  formatLocalDateTime,
  formatNumber,
  formatObserverLocation,
  formatScientific,
  toPersianDigits,
} from './format';

describe('Persian formatting helpers', () => {
  it('converts Latin digits and formats numbers', () => {
    expect(toPersianDigits('2026')).toBe('۲۰۲۶');
    expect(formatNumber(1234)).toContain('۱');
    expect(formatNumber(Number.NaN)).toBe('—');
  });

  it('formats very large values in scientific notation without losing units', () => {
    const formatted = formatScientific(5.9722e24, 4);
    expect(formatted).toContain('×');
    expect(formatted).toContain('۱۰');
    expect(formatted).toContain('²⁴');
    expect(formatScientific(149.598, 3)).toContain('۱۴۹');
  });

  it('formats factual values, ranges, and temperatures', () => {
    const moon = getBodyById('moon');
    const radius = moon?.facts.find(
      (fact) => fact.kind === 'quantity' && fact.id === 'mean-radius',
    );
    expect(radius && formatFactValue(radius)).toContain('کیلومتر');

    const range = moon?.facts.find(
      (fact) => fact.kind === 'quantity' && fact.id === 'surface-temperature-range',
    );
    expect(range && formatFactValue(range)).toContain('تا');

    const textFact: BodyFact = {
      kind: 'text',
      id: 'test',
      labelFa: 'آزمون',
      valueFa: 'مقدار متنی',
      dataType: 'measured',
      sourceIds: [],
    };
    expect(formatFactValue(textFact)).toBe('مقدار متنی');
  });

  it('formats angles, compass directions, and distances', () => {
    expect(formatAngle(33.087403)).toContain('°');
    expect(compassDirectionFa(0)).toBe('شمال');
    expect(compassDirectionFa(90)).toBe('شرق');
    expect(compassDirectionFa(187)).toBe('جنوب');
    expect(compassDirectionFa(315)).toBe('شمال‌غرب');
    expect(formatDistanceKm(384400)).toContain('کیلومتر');
    expect(formatDistanceKm(2.4e8)).toContain('میلیون کیلومتر');
  });

  it('formats an observer location with hemispheres', () => {
    const formatted = formatObserverLocation({
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      heightM: 0,
      source: 'manual',
    });
    expect(formatted).toContain('شمالی');
    expect(formatted).toContain('شرقی');
    expect(formatted).toContain('۳۵');
  });

  it('formats illumination and local dates safely', () => {
    expect(formatIllumination(0.42)).toContain('٪');
    expect(formatIllumination(null)).toBe('—');
    expect(formatLocalDateTime(new Date('2026-01-15T09:00:00Z'))).not.toBe('');
  });
});
