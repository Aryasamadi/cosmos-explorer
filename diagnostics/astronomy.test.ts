import { describe, expect, it } from 'vitest';
import { Body, Illumination } from 'astronomy-engine';
import * as THREE from 'three';
import {
  cityLightsVisibility,
  computeSubsolarPoint,
  earthDayFactor,
  solarDotAt,
} from '../src/astronomy/ephemeris/subsolarPoint';
import {
  computeReferenceFrame,
  phaseFractionFromBodyState,
} from '../src/astronomy/referenceFrame';
import {
  geodeticToUnitVector,
  unitVectorToGeodetic,
} from '../src/geo/earthCoordinates';
import {
  getEarthDisplayQuaternion,
  localDirectionToScene,
} from '../src/engine/free/earthDisplayFrame';

const FIXED_DATE = new Date('2026-06-21T12:00:00.000Z');
const DATES = [
  '2026-01-15T00:00:00.000Z',
  '2026-03-20T12:00:00.000Z',
  '2026-06-21T12:00:00.000Z',
  '2026-09-23T00:00:00.000Z',
  '2026-12-21T12:00:00.000Z',
] as const;

function angleDeg(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  const cosine = left.x * right.x + left.y * right.y + left.z * right.z;
  return THREE.MathUtils.radToDeg(
    Math.acos(THREE.MathUtils.clamp(cosine, -1, 1)),
  );
}

describe('fixed-date astronomical reference', () => {
  it('places the June solstice subsolar point near the Tropic of Cancer', () => {
    const subsolar = computeSubsolarPoint(FIXED_DATE);
    expect(subsolar.latitudeDeg).toBeCloseTo(23.44, 2);
    expect(subsolar.longitudeDeg).toBeCloseTo(0.45, 1);
  });

  it('separates sunlit and night locations at the fixed instant', () => {
    const subsolar = computeSubsolarPoint(FIXED_DATE);
    expect(
      solarDotAt({ latitudeDeg: 30.0444, longitudeDeg: 31.2357 }, subsolar),
    ).toBeGreaterThan(0.7);
    expect(
      solarDotAt({ latitudeDeg: 21.3069, longitudeDeg: -157.8583 }, subsolar),
    ).toBeLessThan(-0.5);
    expect(earthDayFactor(0.5)).toBeCloseTo(1, 6);
    expect(earthDayFactor(-0.5)).toBeCloseTo(0, 6);
    expect(cityLightsVisibility(0.5)).toBeCloseTo(0, 6);
    expect(cityLightsVisibility(-0.5)).toBeCloseTo(1, 6);
  });

  it('round-trips geographic coordinates through the local render frame', () => {
    for (const coordinate of [
      { latitudeDeg: 35.6892, longitudeDeg: 51.389 },
      { latitudeDeg: -33.8688, longitudeDeg: 151.2093 },
      { latitudeDeg: 0, longitudeDeg: 179.99 },
      { latitudeDeg: 84, longitudeDeg: -179.99 },
    ]) {
      const vector = geodeticToUnitVector(
        coordinate.latitudeDeg,
        coordinate.longitudeDeg,
      );
      const result = unitVectorToGeodetic(vector);
      expect(result.latitudeDeg).toBeCloseTo(coordinate.latitudeDeg, 5);
      expect(
        Math.abs(
          ((result.longitudeDeg - coordinate.longitudeDeg + 540) % 360) - 180,
        ),
      ).toBeLessThan(1e-4);
    }
  });
});

describe('scientific frame and lighting', () => {
  it.each(DATES)('keeps scene Sun within 5 degrees of the subsolar point at %s', (iso) => {
    const date = new Date(iso);
    const frame = computeReferenceFrame(date);
    const subsolar = computeSubsolarPoint(date);
    const subsolarLocal = geodeticToUnitVector(
      subsolar.latitudeDeg,
      subsolar.longitudeDeg,
    );

    const sceneSun = localDirectionToScene(frame.sun.directionFromEarth);
    const sceneSubsolar = localDirectionToScene(subsolarLocal);
    expect(THREE.MathUtils.radToDeg(sceneSun.angleTo(sceneSubsolar))).toBeLessThan(5);

    const displayRotation = getEarthDisplayQuaternion();
    const sunInEarthFrame = sceneSun
      .clone()
      .applyQuaternion(displayRotation.invert())
      .normalize();
    expect(angleDeg(sunInEarthFrame, subsolarLocal)).toBeLessThan(5);
  });

  it.each(DATES)('matches Moon and Mars illuminated fractions at %s', (iso) => {
    const date = new Date(iso);
    const frame = computeReferenceFrame(date);

    for (const [body, state] of [
      [Body.Moon, frame.moon],
      [Body.Mars, frame.mars],
    ] as const) {
      const reference = Illumination(body, date).phase_fraction;
      const rendered = phaseFractionFromBodyState(state);
      expect(Math.abs(rendered - reference)).toBeLessThan(0.1);
      if (reference >= 0.1) {
        expect(Math.abs(rendered - reference) / reference).toBeLessThan(0.1);
      }
    }
  });

  it('does not reuse the Earth-Sun direction to illuminate Mars', () => {
    const frame = computeReferenceFrame(FIXED_DATE);
    expect(angleDeg(frame.mars.sunDirection, frame.sun.sunDirection)).toBeGreaterThan(1);
  });
});
