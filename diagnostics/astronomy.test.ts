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
  geodeticToUnitVector,
  unitVectorToGeodetic,
} from '../src/geo/earthCoordinates';

const FIXED_DATE = new Date('2026-06-21T12:00:00.000Z');

// These scene constants mirror src/engine/free/solarSystem.ts. Production does
// not expose a scene probe, so this test intentionally duplicates them; the
// duplication itself is a documented Phase-0 observability gap.
const SCENE = {
  sunPosition: new THREE.Vector3(22, 7, 24),
  moonPosition: new THREE.Vector3(4.9, 0.35, 3.1),
  marsPosition: new THREE.Vector3(-10.5, -1.1, 14.6),
  earthSpinRadians: 2.1,
  earthTiltDegrees: 23.44,
} as const;

function sceneSunInEarthFrame(): THREE.Vector3 {
  const tilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(SCENE.earthTiltDegrees),
  );
  const spin = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    SCENE.earthSpinRadians,
  );
  const worldQuaternion = tilt.multiply(spin);
  return SCENE.sunPosition
    .clone()
    .normalize()
    .applyQuaternion(worldQuaternion.invert())
    .normalize();
}

function sceneDirectionalPhaseFraction(bodyPosition: THREE.Vector3): number {
  // The production Moon/Mars material uses this one DirectionalLight for every
  // body. Its incoming direction is the fixed scene-Sun direction.
  const toLight = SCENE.sunPosition.clone().normalize();
  const toEarth = bodyPosition.clone().negate().normalize();
  const cosine = THREE.MathUtils.clamp(toLight.dot(toEarth), -1, 1);
  return (1 + cosine) / 2;
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

  it.fails(
    'KNOWN DEFECT: scene-Sun direction must agree with the real Earth subsolar point',
    () => {
      const subsolar = computeSubsolarPoint(FIXED_DATE);
      const realSun = new THREE.Vector3(
        geodeticToUnitVector(subsolar.latitudeDeg, subsolar.longitudeDeg).x,
        geodeticToUnitVector(subsolar.latitudeDeg, subsolar.longitudeDeg).y,
        geodeticToUnitVector(subsolar.latitudeDeg, subsolar.longitudeDeg).z,
      );
      const sceneSun = sceneSunInEarthFrame();
      const angleDeg =
        THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(sceneSun.dot(realSun), -1, 1)));
      expect(angleDeg).toBeLessThan(5);
    },
  );

  it.fails(
    'KNOWN DEFECT: rendered Moon phase must follow the real Moon illumination',
    () => {
      const real = Illumination(Body.Moon, FIXED_DATE).phase_fraction;
      const scene = sceneDirectionalPhaseFraction(SCENE.moonPosition);
      expect(Math.abs(scene - real)).toBeLessThan(0.1);
    },
  );

  it.fails(
    'KNOWN DEFECT: rendered Mars phase must follow the real Mars illumination',
    () => {
      const real = Illumination(Body.Mars, FIXED_DATE).phase_fraction;
      const scene = sceneDirectionalPhaseFraction(SCENE.marsPosition);
      expect(Math.abs(scene - real)).toBeLessThan(0.1);
    },
  );
});
