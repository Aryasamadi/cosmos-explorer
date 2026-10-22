import { describe, expect, it } from 'vitest';
import {
  clamp,
  normalizeDegrees,
  normalizeHours,
  normalizeSignedDegrees,
} from './angles';

describe('angle contracts', () => {
  it('normalizes degrees into [0, 360)', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(-1)).toBe(359);
    expect(normalizeDegrees(721)).toBe(1);
    expect(normalizeDegrees(-721)).toBe(359);
  });

  it('normalizes signed degrees into (-180, 180]', () => {
    expect(normalizeSignedDegrees(0)).toBe(0);
    expect(normalizeSignedDegrees(180)).toBe(180);
    expect(normalizeSignedDegrees(181)).toBe(-179);
    expect(normalizeSignedDegrees(-181)).toBe(179);
    expect(normalizeSignedDegrees(-180)).toBe(180);
  });

  it('normalizes sidereal hours into [0, 24)', () => {
    expect(normalizeHours(0)).toBe(0);
    expect(normalizeHours(24)).toBe(0);
    expect(normalizeHours(-1)).toBe(23);
    expect(normalizeHours(25.5)).toBe(1.5);
  });

  it('rejects non-finite values instead of leaking NaN', () => {
    expect(() => normalizeDegrees(Number.NaN)).toThrow(RangeError);
    expect(() => normalizeDegrees(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => normalizeHours(Number.NaN)).toThrow(RangeError);
  });

  it('clamps and validates bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
    expect(() => clamp(Number.NaN, 0, 1)).toThrow(RangeError);
  });
});
