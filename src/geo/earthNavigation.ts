const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface EarthNavigationSensitivity {
  /** Multiplier consumed by OrbitControls for drag rotation. */
  rotateSpeed: number;
  /** Multiplier consumed by OrbitControls for wheel/pinch dolly. */
  zoomSpeed: number;
  /** Approximate angular width of the visible surface patch, in degrees. */
  visibleExtentDeg: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Altitude-aware navigation sensitivity.
 *
 * OrbitControls maps a full-height vertical drag to 2π * rotateSpeed radians
 * and uses clientHeight in its pixel conversion, so a viewport-independent
 * rotateSpeed is sufficient: pixels-per-degree scales with viewport height.
 * Near the surface the visible ground patch is tiny, so a drag must rotate by
 * a correspondingly tiny angle. The curve is continuous and bounded.
 */
export function computeEarthNavigationSensitivity(
  cameraDistance: number,
  fovDeg: number,
): EarthNavigationSensitivity {
  if (!Number.isFinite(cameraDistance) || cameraDistance <= 1) {
    throw new RangeError('Camera distance must be finite and greater than one.');
  }
  if (!Number.isFinite(fovDeg) || fovDeg <= 0 || fovDeg >= 180) {
    throw new RangeError('FOV must be finite and between 0 and 180 degrees.');
  }

  const height = Math.max(cameraDistance - 1, 0.0001);
  const visibleExtentDeg =
    2 * Math.atan(height * Math.tan((fovDeg / 2) * DEG_TO_RAD)) * RAD_TO_DEG;

  // A full-height drag should rotate by roughly one visible surface extent.
  // The lower bound prevents a user from becoming stuck at street level; the
  // upper bound keeps the global view from spinning excessively.
  const rotateSpeed = clamp(visibleExtentDeg / 360, 0.00008, 0.3);
  const zoomSpeed = clamp(
    0.22 + Math.min(height, 6.5) * 0.095,
    0.22,
    0.82,
  );

  return { rotateSpeed, zoomSpeed, visibleExtentDeg };
}

/** Prevents the camera from being placed inside the Earth during any motion. */
export function clampCameraDistance(
  currentDistance: number,
  minimumDistance: number,
): number {
  if (!Number.isFinite(currentDistance) || !Number.isFinite(minimumDistance)) {
    throw new RangeError('Camera distances must be finite.');
  }
  if (minimumDistance <= 0) {
    throw new RangeError('Minimum distance must be positive.');
  }
  return Math.max(currentDistance, minimumDistance);
}
