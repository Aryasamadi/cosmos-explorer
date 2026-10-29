import * as THREE from 'three';
import type { ReferenceFrame } from '../../astronomy/referenceFrame';
import { localDirectionToScene } from './earthDisplayFrame';

export interface SceneSunDirections {
  /**
   * Direction from Earth toward the Sun in the Earth-fixed local frame.
   * Earth, detail and OSM shaders evaluate object-space normals, so their
   * sunlight must stay in this frame rather than scene world space.
   */
  earthLocal: THREE.Vector3;
  /** Direction from the Moon toward the Sun in scene world space. */
  moonScene: THREE.Vector3;
  /** Direction from Mars toward the Sun in scene world space. */
  marsScene: THREE.Vector3;
}

/**
 * Physical Sun directions for the rendered bodies at one reference instant.
 * The reference frame already carries the actual body-to-Sun vectors, which
 * remain valid even where display distances are compressed. No camera state or
 * per-body display position participates in this computation.
 */
export function physicalSunDirections(frame: ReferenceFrame): SceneSunDirections {
  return {
    earthLocal: new THREE.Vector3(
      frame.sun.directionFromEarth.x,
      frame.sun.directionFromEarth.y,
      frame.sun.directionFromEarth.z,
    ).normalize(),
    moonScene: localDirectionToScene(frame.moon.sunDirection),
    marsScene: localDirectionToScene(frame.mars.sunDirection),
  };
}

/** Fraction of a sphere's visible disk illuminated; both vectors point away from the body. */
export function visiblePhaseFraction(
  viewDirection: THREE.Vector3,
  lightDirection: THREE.Vector3,
): number {
  const viewLength = viewDirection.length();
  const lightLength = lightDirection.length();
  if (viewLength < 1e-9 || lightLength < 1e-9) {
    throw new RangeError('View and light directions must be non-zero.');
  }
  const dot = viewDirection.dot(lightDirection) / (viewLength * lightLength);
  return THREE.MathUtils.clamp((1 + dot) / 2, 0, 1);
}
