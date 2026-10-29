import { Body, Illumination } from 'astronomy-engine';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeSubsolarPoint } from '../../astronomy/ephemeris/subsolarPoint';
import {
  computeReferenceFrame,
  phaseFractionFromBodyState,
} from '../../astronomy/referenceFrame';
import { geodeticToUnitVector } from '../../geo/earthCoordinates';
import {
  EARTH_DISPLAY_DISTANCES,
  localDirectionToScene,
} from './earthDisplayFrame';
import { physicalSunDirections, visiblePhaseFraction } from './physicalLighting';

const DATES = [
  '2026-01-15T00:00:00.000Z',
  '2026-03-20T12:00:00.000Z',
  '2026-06-21T12:00:00.000Z',
  '2026-09-23T00:00:00.000Z',
  '2026-10-25T14:26:00.000Z',
  '2026-12-21T12:00:00.000Z',
] as const;

function angleDeg(left: THREE.Vector3, right: THREE.Vector3): number {
  return THREE.MathUtils.radToDeg(left.angleTo(right));
}

function earthObserverPhase(
  bodyPosition: THREE.Vector3,
  sunDirection: THREE.Vector3,
): number {
  return visiblePhaseFraction(bodyPosition.clone().negate(), sunDirection);
}

describe('physical scene sunlight', () => {
  it('uses the body-to-Sun direction in each shader coordinate frame', () => {
    for (const iso of DATES) {
      const frame = computeReferenceFrame(new Date(iso));
      const directions = physicalSunDirections(frame);

      const localSun = new THREE.Vector3(
        frame.sun.directionFromEarth.x,
        frame.sun.directionFromEarth.y,
        frame.sun.directionFromEarth.z,
      );
      expect(angleDeg(directions.earthLocal, localSun)).toBeLessThan(1e-6);
      expect(
        angleDeg(directions.moonScene, localDirectionToScene(frame.moon.sunDirection)),
      ).toBeLessThan(1e-6);
      expect(
        angleDeg(directions.marsScene, localDirectionToScene(frame.mars.sunDirection)),
      ).toBeLessThan(1e-6);

      for (const direction of Object.values(directions)) {
        expect(direction.length()).toBeCloseTo(1, 10);
      }
    }
  });

  it('keeps all Sun directions unchanged when only the camera moves', () => {
    const frame = computeReferenceFrame(new Date('2026-06-21T12:00:00.000Z'));
    const before = physicalSunDirections(frame);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 1200);
    camera.position.set(6.4, -2.1, 4.7);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const after = physicalSunDirections(frame);
    expect(after.earthLocal.toArray()).toEqual(before.earthLocal.toArray());
    expect(after.moonScene.toArray()).toEqual(before.moonScene.toArray());
    expect(after.marsScene.toArray()).toEqual(before.marsScene.toArray());
  });

  it('anchors the Earth terminator to the subsolar point in local coordinates', () => {
    for (const iso of DATES) {
      const date = new Date(iso);
      const frame = computeReferenceFrame(date);
      const { earthLocal } = physicalSunDirections(frame);
      const subsolar = computeSubsolarPoint(date);
      const local = geodeticToUnitVector(
        subsolar.latitudeDeg,
        subsolar.longitudeDeg,
      );
      const subsolarNormal = new THREE.Vector3(local.x, local.y, local.z);

      const dot = earthLocal.dot(subsolarNormal);
      expect(dot).toBeCloseTo(1, 6);
    }
  });

  it.each(DATES)(
    'matches the astronomical Moon and Mars phase from an Earth observer at %s',
    (iso) => {
      const date = new Date(iso);
      const frame = computeReferenceFrame(date);
      const directions = physicalSunDirections(frame);

      const moonPosition = localDirectionToScene(
        frame.moon.directionFromEarth,
      ).multiplyScalar(EARTH_DISPLAY_DISTANCES.moon);
      const marsPosition = localDirectionToScene(
        frame.mars.directionFromEarth,
      ).multiplyScalar(EARTH_DISPLAY_DISTANCES.mars);

      const moonReference = Illumination(Body.Moon, date).phase_fraction;
      const marsReference = Illumination(Body.Mars, date).phase_fraction;

      expect(
        Math.abs(
          earthObserverPhase(moonPosition, directions.moonScene) - moonReference,
        ),
      ).toBeLessThan(0.001);
      expect(
        Math.abs(
          earthObserverPhase(marsPosition, directions.marsScene) - marsReference,
        ),
      ).toBeLessThan(0.001);
      expect(
        Math.abs(
          phaseFractionFromBodyState(frame.moon) - moonReference,
        ),
      ).toBeLessThan(0.001);
    },
  );

  it('changes Sun directions as simulation time advances', () => {
    const first = computeReferenceFrame(new Date('2026-06-21T00:00:00.000Z'));
    const second = computeReferenceFrame(new Date('2026-06-21T12:00:00.000Z'));
    const firstDirections = physicalSunDirections(first);
    const secondDirections = physicalSunDirections(second);

    expect(angleDeg(firstDirections.earthLocal, secondDirections.earthLocal)).toBeGreaterThan(
      1,
    );
    expect(angleDeg(firstDirections.moonScene, secondDirections.moonScene)).toBeGreaterThan(
      1,
    );
    expect(
      angleDeg(firstDirections.moonScene, secondDirections.moonScene),
    ).toBeCloseTo(
      angleDeg(
        localDirectionToScene(first.moon.sunDirection),
        localDirectionToScene(second.moon.sunDirection),
      ),
      6,
    );
  });

  it('computes complementary phases for opposite observers of the same lit sphere', () => {
    const frame = computeReferenceFrame(new Date('2026-10-25T14:26:00.000Z'));
    const { moonScene } = physicalSunDirections(frame);
    const moonPosition = localDirectionToScene(
      frame.moon.directionFromEarth,
    ).multiplyScalar(EARTH_DISPLAY_DISTANCES.moon);

    const earthFacing = visiblePhaseFraction(
      moonPosition.clone().negate(),
      moonScene,
    );
    const opposite = visiblePhaseFraction(moonPosition, moonScene);
    expect(earthFacing + opposite).toBeCloseTo(1, 10);
    expect(earthFacing).toBeGreaterThan(0.99);
    expect(opposite).toBeLessThan(0.01);
  });

  it('rejects degenerate view or light vectors', () => {
    expect(() =>
      visiblePhaseFraction(new THREE.Vector3(), new THREE.Vector3(1, 0, 0)),
    ).toThrow(/non-zero/);
    expect(() =>
      visiblePhaseFraction(new THREE.Vector3(0, 0, 1), new THREE.Vector3()),
    ).toThrow(/non-zero/);
  });
});
