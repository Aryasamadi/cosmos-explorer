import * as THREE from 'three';

export type TranslationAxis =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'up'
  | 'down';

export type RotationAxis =
  | 'lookLeft'
  | 'lookRight'
  | 'lookUp'
  | 'lookDown'
  | 'rollLeft'
  | 'rollRight';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);

const BASE_SPEED = 2.4;
const BOOST_MULTIPLIER = 2.8;
const ACCELERATION = 6.5;
const LOOK_RATE = 1.25;
const ROLL_RATE = 1.6;
const MAX_FLIGHT_DISTANCE = 110;
const MIN_EARTH_DISTANCE = 1.0006;

const scratchForward = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchTarget = new THREE.Vector3();
const scratchYaw = new THREE.Quaternion();
const scratchPitch = new THREE.Quaternion();
const scratchRoll = new THREE.Quaternion();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Translational and rotational sensitivity grow with the distance from the
 * nearest surface, so close approaches stay controllable while deep space
 * traversals remain practical.
 */
export function computeProximityMotionScale(surfaceGap: number): number {
  if (!Number.isFinite(surfaceGap)) {
    throw new RangeError('Surface gap must be finite.');
  }
  return clamp(0.18 + Math.max(0, surfaceGap) * 0.16, 0.18, 2.4);
}

export function cameraForward(
  camera: THREE.Camera,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out.copy(FORWARD).applyQuaternion(camera.quaternion).normalize();
}

export function cameraRight(
  camera: THREE.Camera,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out.copy(RIGHT).applyQuaternion(camera.quaternion).normalize();
}

/** Quaternion that points the camera's -Z axis at `target`. */
export function quaternionLookingAt(
  position: THREE.Vector3,
  target: THREE.Vector3,
  out = new THREE.Quaternion(),
): THREE.Quaternion {
  const direction = target.clone().sub(position);
  if (direction.lengthSq() < 1e-12) return out.identity();
  direction.normalize();
  const up =
    Math.abs(direction.y) > 0.9995
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4().lookAt(position, target, up);
  return out.setFromRotationMatrix(matrix);
}

/**
 * Camera-relative 6DOF controller. Rotation never changes position, and
 * translation never changes orientation. Position is independent of any
 * look-at target; the target is only provided to renderer helpers downstream.
 */
export class FreeFlightController {
  readonly velocity = new THREE.Vector3();
  private readonly translation = new Set<TranslationAxis>();
  private readonly rotation = new Set<RotationAxis>();
  private boost = false;
  private enabled = true;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.clearInputs();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setTranslation(axis: TranslationAxis, active: boolean): void {
    if (active) this.translation.add(axis);
    else this.translation.delete(axis);
  }

  setRotation(axis: RotationAxis, active: boolean): void {
    if (active) this.rotation.add(axis);
    else this.rotation.delete(axis);
  }

  setBoost(active: boolean): void {
    this.boost = active;
  }

  clearInputs(): void {
    this.translation.clear();
    this.rotation.clear();
    this.boost = false;
    this.velocity.set(0, 0, 0);
  }

  /** Applies a small local rotation without touching the camera position. */
  applyLook(yaw: number, pitch: number, roll: number): void {
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch) || !Number.isFinite(roll)) {
      return;
    }
    if (yaw === 0 && pitch === 0 && roll === 0) return;

    const qYaw = scratchYaw.setFromAxisAngle(LOCAL_UP, -yaw);
    const qPitch = scratchPitch.setFromAxisAngle(RIGHT, pitch);
    const qRoll = scratchRoll.setFromAxisAngle(LOCAL_FORWARD, roll);
    this.camera.quaternion
      .multiply(qYaw.multiply(qPitch).multiply(qRoll))
      .normalize();
  }

  /** Wheel/pinch impulse along the current view direction. */
  addForwardImpulse(amount: number): void {
    if (!Number.isFinite(amount)) return;
    cameraForward(this.camera, scratchForward);
    this.velocity.addScaledVector(scratchForward, amount);
    this.velocity.clampLength(0, 40);
  }

  /** Screen-space drag translation, independent of look rotation. */
  addScreenImpulse(dx: number, dy: number, scale: number): void {
    if (![dx, dy, scale].every(Number.isFinite)) return;
    cameraRight(this.camera, scratchRight);
    scratchUp.copy(LOCAL_UP).applyQuaternion(this.camera.quaternion).normalize();
    this.velocity
      .addScaledVector(scratchRight, dx * scale)
      .addScaledVector(scratchUp, -dy * scale);
    this.velocity.clampLength(0, 40);
  }

  update(deltaSeconds: number, motionScale: number): void {
    if (!this.enabled || deltaSeconds <= 0) return;

    const yaw =
      (this.rotation.has('lookRight') ? 1 : 0) -
      (this.rotation.has('lookLeft') ? 1 : 0);
    const pitch =
      (this.rotation.has('lookUp') ? 1 : 0) -
      (this.rotation.has('lookDown') ? 1 : 0);
    const roll =
      (this.rotation.has('rollRight') ? 1 : 0) -
      (this.rotation.has('rollLeft') ? 1 : 0);
    if (yaw !== 0 || pitch !== 0 || roll !== 0) {
      this.applyLook(
        yaw * LOOK_RATE * deltaSeconds,
        pitch * LOOK_RATE * deltaSeconds,
        roll * ROLL_RATE * deltaSeconds,
      );
    }

    cameraForward(this.camera, scratchForward);
    cameraRight(this.camera, scratchRight);

    scratchTarget.set(0, 0, 0);
    if (this.translation.has('forward')) scratchTarget.add(scratchForward);
    if (this.translation.has('back')) scratchTarget.sub(scratchForward);
    if (this.translation.has('right')) scratchTarget.add(scratchRight);
    if (this.translation.has('left')) scratchTarget.sub(scratchRight);
    if (this.translation.has('up')) scratchTarget.add(WORLD_UP);
    if (this.translation.has('down')) scratchTarget.sub(WORLD_UP);

    const safeScale = clamp(
      Number.isFinite(motionScale) ? motionScale : 1,
      0.05,
      4,
    );
    if (scratchTarget.lengthSq() > 0) {
      scratchTarget
        .normalize()
        .multiplyScalar(BASE_SPEED * safeScale * (this.boost ? BOOST_MULTIPLIER : 1));
    }
    const response = 1 - Math.exp(-ACCELERATION * deltaSeconds);
    this.velocity.lerp(scratchTarget, response);
    if (this.velocity.lengthSq() < 1e-10) this.velocity.set(0, 0, 0);

    this.camera.position.addScaledVector(this.velocity, deltaSeconds);
    this.clampPosition();
  }

  clampPosition(): void {
    const distance = this.camera.position.length();
    if (distance < MIN_EARTH_DISTANCE) {
      this.camera.position.setLength(MIN_EARTH_DISTANCE);
      const radial = this.camera.position.clone().normalize();
      const inward = this.velocity.dot(radial);
      if (inward < 0) this.velocity.addScaledVector(radial, -inward);
    } else if (distance > MAX_FLIGHT_DISTANCE) {
      this.camera.position.setLength(MAX_FLIGHT_DISTANCE);
      const radial = this.camera.position.clone().normalize();
      const outward = this.velocity.dot(radial);
      if (outward > 0) this.velocity.addScaledVector(radial, -outward);
    }
  }
}
