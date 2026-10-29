import { Body, Illumination } from 'astronomy-engine';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeSubsolarPoint, solarDotAt } from './ephemeris/subsolarPoint';
import {
  computeReferenceFrame,
  phaseFractionFromBodyState,
} from './referenceFrame';
import { geodeticToUnitVector } from '../geo/earthCoordinates';
import {
  getEarthDisplayQuaternion,
  localDirectionToScene,
} from '../engine/free/earthDisplayFrame';

const DATES = [
  '2026-01-15T00:00:00.000Z',
  '2026-03-20T12:00:00.000Z',
  '2026-06-21T12:00:00.000Z',
  '2026-09-23T00:00:00.000Z',
  '2026-12-21T12:00:00.000Z',
] as const;

function angleBetween(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  const cosine = left.x * right.x + left.y * right.y + left.z * right.z;
  return THREE.MathUtils.radToDeg(
    Math.acos(THREE.MathUtils.clamp(cosine, -1, 1)),
  );
}

function assertUnit(vector: { x: number; y: number; z: number }): void {
  expect(Math.hypot(vector.x, vector.y, vector.z)).toBeCloseTo(1, 10);
}

describe('shared scientific reference frame', () => {
  it('keeps the frame Sun aligned with the independently computed subsolar point', () => {
    for (const iso of DATES) {
      const date = new Date(iso);
      const frame = computeReferenceFrame(date);
      const subsolar = computeSubsolarPoint(date);
      const independent = geodeticToUnitVector(
        subsolar.latitudeDeg,
        subsolar.longitudeDeg,
      );

      expect(angleBetween(frame.sun.directionFromEarth, independent)).toBeLessThan(0.01);

      const sceneSun = localDirectionToScene(frame.sun.directionFromEarth);
      const sceneSubsolar = localDirectionToScene(independent);
      expect(
        THREE.MathUtils.radToDeg(sceneSun.angleTo(sceneSubsolar)),
      ).toBeLessThan(5);
    }
  });

  it('produces finite unit directions for Sun, Moon, and Mars at several UTC times', () => {
    for (const iso of DATES) {
      const frame = computeReferenceFrame(new Date(iso));
      for (const body of [frame.sun, frame.moon, frame.mars]) {
        assertUnit(body.directionFromEarth);
        assertUnit(body.sunDirection);
        expect(body.distanceAu).toBeGreaterThan(0);
        expect(Number.isFinite(body.distanceAu)).toBe(true);
      }
    }
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

  it.each(DATES)('keeps the Moon phase fraction aligned with the reference at %s', (iso) => {
    const date = new Date(iso);
    const frame = computeReferenceFrame(date);
    const reference = Illumination(Body.Moon, date).phase_fraction;
    expect(Math.abs(phaseFractionFromBodyState(frame.moon) - reference)).toBeLessThan(
      0.001,
    );
  });

  it('uses the body-local Sun direction for Mars, not the Earth-Sun direction', () => {
    const frame = computeReferenceFrame(new Date('2026-06-21T12:00:00.000Z'));
    const angle = angleBetween(frame.mars.sunDirection, frame.sun.sunDirection);
    expect(angle).toBeGreaterThan(1);
  });

  it('separates day and night locations from the shared subsolar point', () => {
    const frame = computeReferenceFrame(new Date('2026-06-21T12:00:00.000Z'));
    const subsolar = {
      latitudeDeg: THREE.MathUtils.radToDeg(
        Math.asin(frame.sun.directionFromEarth.y),
      ),
      longitudeDeg: THREE.MathUtils.radToDeg(
        Math.atan2(
          -frame.sun.directionFromEarth.z,
          frame.sun.directionFromEarth.x,
        ),
      ),
    };
    expect(
      solarDotAt({ latitudeDeg: 30.0444, longitudeDeg: 31.2357 }, subsolar),
    ).toBeGreaterThan(0.7);
    expect(
      solarDotAt({ latitudeDeg: 21.3069, longitudeDeg: -157.8583 }, subsolar),
    ).toBeLessThan(-0.5);
  });

  it('is deterministic for the same instant and rejects invalid dates', () => {
    const date = new Date('2026-12-21T12:00:00.000Z');
    expect(computeReferenceFrame(date)).toEqual(computeReferenceFrame(date));
    expect(() => computeReferenceFrame(new Date(Number.NaN))).toThrow(RangeError);
  });

  it('rotates the whole frame consistently into scene space', () => {
    const rotation = getEarthDisplayQuaternion();
    const local = { x: 0.24, y: -0.53, z: 0.81 };
    const length = Math.hypot(local.x, local.y, local.z);
    const unit = { x: local.x / length, y: local.y / length, z: local.z / length };
    const world = localDirectionToScene(unit);
    const back = world.clone().applyQuaternion(rotation.clone().invert()).normalize();
    expect(angleBetween(unit, { x: back.x, y: back.y, z: back.z })).toBeLessThan(1e-6);
  });
});
