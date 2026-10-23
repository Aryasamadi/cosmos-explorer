import * as THREE from 'three';
import type { LocalVector } from '../../geo/types';

/** Presentation-only orientation of the displayed Earth. */
export const EARTH_DISPLAY_TILT_DEG = 23.44;
export const EARTH_DISPLAY_SPIN_RAD = 2.1;

/**
 * Compressed scene radii. These are display distances, not physical scales;
 * illumination directions are supplied separately by the reference frame.
 */
export const EARTH_DISPLAY_DISTANCES = {
  sun: 34,
  moon: 5.8,
  mars: 18,
} as const;

const TILT_AXIS = new THREE.Vector3(0, 0, 1);
const SPIN_AXIS = new THREE.Vector3(0, 1, 0);

const DISPLAY_QUATERNION = new THREE.Quaternion()
  .setFromAxisAngle(TILT_AXIS, THREE.MathUtils.degToRad(EARTH_DISPLAY_TILT_DEG))
  .multiply(
    new THREE.Quaternion().setFromAxisAngle(SPIN_AXIS, EARTH_DISPLAY_SPIN_RAD),
  );
export function getEarthDisplayQuaternion(): THREE.Quaternion {
  return DISPLAY_QUATERNION.clone();
}

export function localDirectionToScene(
  local: LocalVector,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out.set(local.x, local.y, local.z).applyQuaternion(DISPLAY_QUATERNION).normalize();
}
