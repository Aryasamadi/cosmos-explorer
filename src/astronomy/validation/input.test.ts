import { describe, expect, it } from 'vitest';
import {
  assertValidDate,
  parseLocaleNumber,
  parseLocationInput,
  validateLatitude,
  validateLongitude,
} from './input';

describe('input validation', () => {
  it('parses Persian and Arabic-Indic digits', () => {
    expect(parseLocaleNumber('۳۵٫۶۸۹۲')).toBeCloseTo(35.6892, 6);
    expect(parseLocaleNumber('٥١٫٣٨٩')).toBeCloseTo(51.389, 6);
    expect(parseLocaleNumber(' -۳۵٫۵ ')).toBeCloseTo(-35.5, 6);
    expect(parseLocaleNumber('1,234.5')).toBeNull();
    expect(parseLocaleNumber('۱۲abc')).toBeNull();
    expect(parseLocaleNumber('')).toBeNull();
  });

  it('accepts a valid manual location', () => {
    const result = parseLocationInput('35.6892', '51.3890', '1200');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location).toEqual({
        latitudeDeg: 35.6892,
        longitudeDeg: 51.389,
        heightM: 1200,
        source: 'manual',
      });
    }
  });

  it('reports the invalid field rather than silently clamping', () => {
    expect(parseLocationInput('91', '51')).toEqual({ ok: false, field: 'latitude' });
    expect(parseLocationInput('35', '181')).toEqual({ ok: false, field: 'longitude' });
    expect(parseLocationInput('abc', '51')).toEqual({ ok: false, field: 'format' });
    expect(parseLocationInput('35', '51', '20000')).toEqual({ ok: false, field: 'height' });
  });

  it('validates coordinate ranges', () => {
    expect(validateLatitude(-90)).toBe(-90);
    expect(validateLongitude(180)).toBe(180);
    expect(() => validateLatitude(90.1)).toThrow(RangeError);
    expect(() => validateLongitude(-180.1)).toThrow(RangeError);
  });

  it('rejects invalid dates', () => {
    expect(() => assertValidDate(new Date('invalid'))).toThrow(RangeError);
  });
});
