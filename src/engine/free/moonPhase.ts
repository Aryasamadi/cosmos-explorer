import * as THREE from 'three';

const scratchSun = new THREE.Vector3();
const scratchPerpendicular = new THREE.Vector3();
const scratchFallback = new THREE.Vector3();

/**
 * Builds a display-space light direction that reproduces the chosen
 * geocentric illuminated fraction for the current camera. The compressed
 * Earth-Moon display distance otherwise makes the visible phase depend on the
 * camera position instead of the reference phase.
 */
export function computeMoonDisplayLight(
  viewDirection: THREE.Vector3,
  sunDirection: THREE.Vector3,
  phaseFraction: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const viewLength = viewDirection.length();
  const sunLength = sunDirection.length();
  if (!Number.isFinite(viewLength) || viewLength < 1e-9) {
    throw new RangeError('Moon view direction must be non-zero and finite.');
  }
  if (!Number.isFinite(sunLength) || sunLength < 1e-9) {
    throw new RangeError('Moon Sun direction must be non-zero and finite.');
  }
  if (!Number.isFinite(phaseFraction)) {
    throw new RangeError('Moon phase fraction must be finite.');
  }

  out.copy(viewDirection).divideScalar(viewLength);
  scratchSun.copy(sunDirection).divideScalar(sunLength);
  scratchPerpendicular
    .copy(scratchSun)
    .addScaledVector(out, -scratchSun.dot(out));

  if (scratchPerpendicular.lengthSq() < 1e-12) {
    scratchFallback.set(0, 1, 0);
    if (Math.abs(out.y) > 0.95) scratchFallback.set(1, 0, 0);
    scratchPerpendicular
      .copy(scratchFallback)
      .addScaledVector(out, -scratchFallback.dot(out));
  }
  scratchPerpendicular.normalize();

  const cosine = THREE.MathUtils.clamp(phaseFraction, 0, 1) * 2 - 1;
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  out.multiplyScalar(cosine).addScaledVector(scratchPerpendicular, sine).normalize();
  return out;
}

/** Fraction of a sphere's visible disk illuminated by `lightDirection`. */
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
