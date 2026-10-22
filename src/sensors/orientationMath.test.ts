import { describe, expect, it } from 'vitest';
import {
  applyHeadingOffset,
  buildCameraQuaternion,
  forwardVector,
  headingDegreesFromQuaternion,
  manualLookQuaternion,
  pitchDegreesFromQuaternion,
  quaternionLength,
  screenAngleDegrees,
  type OrientationSample,
} from './orientationMath';

function sample(overrides: Partial<OrientationSample> = {}): OrientationSample {
  return {
    alphaDeg: 0,
    betaDeg: 90,
    gammaDeg: 0,
    screenAngleDeg: 0,
    absolute: true,
    compassHeadingDeg: null,
    timestampMs: 0,
    ...overrides,
  };
}

function expectForward(
  quaternion: ReturnType<typeof buildCameraQuaternion>,
  expected: [number, number, number],
): void {
  const forward = forwardVector(quaternion);
  expect(forward[0]).toBeCloseTo(expected[0], 5);
  expect(forward[1]).toBeCloseTo(expected[1], 5);
  expect(forward[2]).toBeCloseTo(expected[2], 5);
}

describe('device orientation math', () => {
  it('points an upright phone facing north due north', () => {
    const quaternion = buildCameraQuaternion(sample());
    expectForward(quaternion, [0, 0, -1]);
    expect(headingDegreesFromQuaternion(quaternion)).toBeCloseTo(0, 5);
    expect(pitchDegreesFromQuaternion(quaternion)).toBeCloseTo(0, 5);
    expect(quaternionLength(quaternion)).toBeCloseTo(1, 10);
  });

  it('follows the W3C alpha convention (90 degrees points west)', () => {
    const quaternion = buildCameraQuaternion(sample({ alphaDeg: 90 }));
    expectForward(quaternion, [-1, 0, 0]);
    expect(headingDegreesFromQuaternion(quaternion)).toBeCloseTo(270, 5);
  });

  it('points down when the phone lies flat face-up', () => {
    const quaternion = buildCameraQuaternion(sample({ betaDeg: 0 }));
    expectForward(quaternion, [0, -1, 0]);
    expect(pitchDegreesFromQuaternion(quaternion)).toBeCloseTo(-90, 5);
  });

  it('maps an iOS compass heading to true camera heading', () => {
    const quaternion = buildCameraQuaternion(
      sample({ alphaDeg: 123, compassHeadingDeg: 90 }),
    );
    expectForward(quaternion, [1, 0, 0]);
    expect(headingDegreesFromQuaternion(quaternion)).toBeCloseTo(90, 5);
  });

  it('applies screen rotation as roll without changing heading', () => {
    const portrait = buildCameraQuaternion(sample({ screenAngleDeg: 0 }));
    const landscape = buildCameraQuaternion(sample({ screenAngleDeg: 90 }));
    expect(headingDegreesFromQuaternion(landscape)).toBeCloseTo(
      headingDegreesFromQuaternion(portrait),
      5,
    );
    const portraitForward = forwardVector(portrait);
    const landscapeForward = forwardVector(landscape);
    expect(landscapeForward[0]).toBeCloseTo(portraitForward[0], 5);
    expect(landscapeForward[1]).toBeCloseTo(portraitForward[1], 5);
    expect(landscapeForward[2]).toBeCloseTo(portraitForward[2], 5);
  });

  it('builds a manual look quaternion with heading and pitch', () => {
    const east = manualLookQuaternion(90, 0);
    expectForward(east, [1, 0, 0]);
    expect(headingDegreesFromQuaternion(east)).toBeCloseTo(90, 5);

    const upEast = manualLookQuaternion(90, 30);
    expect(pitchDegreesFromQuaternion(upEast)).toBeCloseTo(30, 5);
    expect(headingDegreesFromQuaternion(upEast)).toBeCloseTo(90, 5);
  });

  it('applies a clockwise heading offset', () => {
    const north = buildCameraQuaternion(sample());
    const offset = applyHeadingOffset(north, 10);
    expect(headingDegreesFromQuaternion(offset)).toBeCloseTo(10, 5);
    const negative = applyHeadingOffset(north, -25);
    expect(headingDegreesFromQuaternion(negative)).toBeCloseTo(335, 5);
  });

  it('reads screen orientation defensively', () => {
    expect(screenAngleDegrees(undefined)).toBe(0);
    expect(
      screenAngleDegrees({ orientation: { angle: 90 } } as unknown as Screen),
    ).toBe(90);
    expect(
      screenAngleDegrees({ orientation: undefined } as unknown as Screen),
    ).toBe(0);
  });

  it('rejects non-finite inputs', () => {
    expect(() => buildCameraQuaternion(sample({ alphaDeg: Number.NaN }))).toThrow(
      RangeError,
    );
    expect(() => manualLookQuaternion(Number.NaN, 0)).toThrow(RangeError);
    expect(() => applyHeadingOffset(buildCameraQuaternion(sample()), Number.NaN)).toThrow(
      RangeError,
    );
  });
});
