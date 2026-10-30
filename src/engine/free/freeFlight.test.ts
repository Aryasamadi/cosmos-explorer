import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  FreeFlightController,
  cameraForward,
  computeProximityMotionScale,
  quaternionLookingAt,
} from './freeFlight';

function makeCamera(position = new THREE.Vector3(0, 0, 10)): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 1200);
  camera.position.copy(position);
  return camera;
}

function runSteps(
  controller: FreeFlightController,
  steps: number,
  scale = 1,
): void {
  for (let index = 0; index < steps; index += 1) {
    controller.update(1 / 60, scale);
  }
}

describe('free-flight camera', () => {
  it('looks at a target without changing position', () => {
    const camera = makeCamera();
    const target = new THREE.Vector3(0, 0, 0);
    camera.quaternion.copy(quaternionLookingAt(camera.position, target));
    const forward = cameraForward(camera);
    expect(forward.z).toBeLessThan(-0.999);
    expect(camera.position.toArray()).toEqual([0, 0, 10]);
  });

  it('rotates in place with quaternion look and roll axes', () => {
    const camera = makeCamera();
    const controller = new FreeFlightController(camera);
    const position = camera.position.clone();

    controller.applyLook(0.3, 0.2, 0);
    expect(camera.position.toArray()).toEqual(position.toArray());
    expect(cameraForward(camera).x).toBeGreaterThan(0);
    expect(cameraForward(camera).y).toBeGreaterThan(0);

    controller.applyLook(0, 0, 0.4);
    expect(camera.position.toArray()).toEqual(position.toArray());
    expect(camera.quaternion.length()).toBeCloseTo(1, 10);

    for (let index = 0; index < 200; index += 1) {
      controller.applyLook(0.17, -0.11, 0.07);
    }
    expect(camera.quaternion.length()).toBeCloseTo(1, 10);
    expect(cameraForward(camera).length()).toBeCloseTo(1, 10);
    expect(Number.isNaN(cameraForward(camera).x)).toBe(false);
    expect(camera.position.toArray()).toEqual(position.toArray());
  });

  it('holds rotation without translating when arrow/roll inputs are active', () => {
    const camera = makeCamera();
    const controller = new FreeFlightController(camera);
    const position = camera.position.clone();
    controller.setRotation('lookRight', true);
    controller.setRotation('lookUp', true);
    controller.setRotation('rollRight', true);
    runSteps(controller, 30);
    expect(camera.position.toArray()).toEqual(position.toArray());
    expect(camera.quaternion.length()).toBeCloseTo(1, 10);
    expect(cameraForward(camera).x).toBeGreaterThan(0);
  });

  it('translates independently on forward/back, right/left and up/down axes', () => {
    const cases = [
      ['forward', new THREE.Vector3(0, 0, -1)],
      ['back', new THREE.Vector3(0, 0, 1)],
      ['right', new THREE.Vector3(1, 0, 0)],
      ['left', new THREE.Vector3(-1, 0, 0)],
      ['up', new THREE.Vector3(0, 1, 0)],
      ['down', new THREE.Vector3(0, -1, 0)],
    ] as const;

    for (const [axis, expected] of cases) {
      const camera = makeCamera();
      const controller = new FreeFlightController(camera);
      const start = camera.position.clone();
      const rotation = camera.quaternion.clone();
      controller.setTranslation(axis, true);
      runSteps(controller, 90);
      const displacement = camera.position.clone().sub(start).normalize();
      expect(displacement.dot(expected)).toBeGreaterThan(0.999);
      expect(camera.quaternion.toArray()).toEqual(rotation.toArray());
    }
  });

  it('applies smooth acceleration and damping', () => {
    const camera = makeCamera();
    const controller = new FreeFlightController(camera);
    controller.setTranslation('forward', true);
    controller.update(1 / 60, 1);
    const firstStep = Math.abs(camera.position.z - 10);
    controller.update(1 / 60, 1);
    const secondStep = Math.abs(camera.position.z - 10) - firstStep;
    expect(secondStep).toBeGreaterThan(firstStep);

    controller.setTranslation('forward', false);
    const speedAtRelease = controller.velocity.length();
    expect(speedAtRelease).toBeGreaterThan(0);
    controller.update(1 / 60, 1);
    expect(controller.velocity.length()).toBeLessThan(speedAtRelease);
  });

  it('honours boost while keeping the same direction', () => {
    const normalCamera = makeCamera();
    const boostedCamera = makeCamera();
    const normal = new FreeFlightController(normalCamera);
    const boosted = new FreeFlightController(boostedCamera);
    normal.setTranslation('forward', true);
    boosted.setTranslation('forward', true);
    boosted.setBoost(true);
    for (let index = 0; index < 60; index += 1) {
      normal.update(1 / 60, 1);
      boosted.update(1 / 60, 1);
    }
    expect(10 - boostedCamera.position.z).toBeGreaterThan(
      (10 - normalCamera.position.z) * 1.5,
    );
  });

  it('moves along the current view direction for wheel impulses', () => {
    const camera = makeCamera();
    const controller = new FreeFlightController(camera);
    controller.applyLook(Math.PI / 2, 0, 0);
    controller.addForwardImpulse(2);
    runSteps(controller, 30);
    expect(camera.position.x).toBeGreaterThan(0.2);
    expect(camera.position.z).toBeCloseTo(10, 5);
  });

  it('moves laterally for screen-space drag impulses', () => {
    const camera = makeCamera();
    const controller = new FreeFlightController(camera);
    controller.addScreenImpulse(20, 0, 0.02);
    runSteps(controller, 30);
    expect(camera.position.x).toBeGreaterThan(0.05);
    expect(camera.position.y).toBeCloseTo(0, 5);
  });

  it('clamps Earth collision and maximum flight distance', () => {
    const nearCamera = makeCamera(new THREE.Vector3(1.0007, 0, 0));
    nearCamera.lookAt(0, 0, 0);
    const near = new FreeFlightController(nearCamera);
    near.velocity.set(-8, 0, 0);
    runSteps(near, 4);
    expect(nearCamera.position.length()).toBeGreaterThanOrEqual(1.0005);

    const farCamera = makeCamera(new THREE.Vector3(109.9, 0, 0));
    const far = new FreeFlightController(farCamera);
    far.velocity.set(8, 0, 0);
    runSteps(far, 4);
    expect(farCamera.position.length()).toBeLessThanOrEqual(110.0001);
  });

  it('does not move when disabled and clears pending input', () => {
    const camera = makeCamera();
    const controller = new FreeFlightController(camera);
    controller.setTranslation('forward', true);
    controller.setEnabled(false);
    runSteps(controller, 30);
    expect(camera.position.toArray()).toEqual([0, 0, 10]);
    expect(controller.velocity.length()).toBe(0);
  });

  it('scales motion with distance from the nearest surface', () => {
    expect(computeProximityMotionScale(0)).toBeCloseTo(0.18, 6);
    expect(computeProximityMotionScale(1)).toBeGreaterThan(
      computeProximityMotionScale(0.2),
    );
    expect(computeProximityMotionScale(20)).toBe(2.4);
    expect(() => computeProximityMotionScale(Number.NaN)).toThrow(RangeError);
  });

  it('produces a valid orientation when looking straight along the up axis', () => {
    const camera = makeCamera(new THREE.Vector3(0, 10, 0));
    const quaternion = quaternionLookingAt(
      camera.position,
      new THREE.Vector3(0, 0, 0),
    );
    expect(quaternion.length()).toBeCloseTo(1, 10);
    expect(Number.isNaN(quaternion.x)).toBe(false);
    camera.quaternion.copy(quaternion);
    expect(cameraForward(camera).y).toBeLessThan(-0.999);
  });
});
