const DEGREES_IN_CIRCLE = 360;
const HOURS_IN_DAY = 24;
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function assertFiniteNumber(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`);
  }
  return value;
}

/** Maps an angle in degrees into [0, 360). */
export function normalizeDegrees(degrees: number): number {
  assertFiniteNumber(degrees, 'degrees');
  const wrapped = degrees % DEGREES_IN_CIRCLE;
  return wrapped < 0 ? wrapped + DEGREES_IN_CIRCLE : wrapped;
}

/** Maps an angle in degrees into (-180, 180]. */
export function normalizeSignedDegrees(degrees: number): number {
  const wrapped = normalizeDegrees(degrees);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/** Maps a time in hours into [0, 24). */
export function normalizeHours(hours: number): number {
  assertFiniteNumber(hours, 'hours');
  const wrapped = hours % HOURS_IN_DAY;
  return wrapped < 0 ? wrapped + HOURS_IN_DAY : wrapped;
}

export function clamp(value: number, min: number, max: number): number {
  assertFiniteNumber(value, 'value');
  assertFiniteNumber(min, 'min');
  assertFiniteNumber(max, 'max');
  if (min > max) {
    throw new RangeError('min must not be greater than max.');
  }
  return Math.min(Math.max(value, min), max);
}

export function clampLatitude(degrees: number): number {
  return clamp(degrees, -90, 90);
}

export function clampLongitude(degrees: number): number {
  return clamp(degrees, -180, 180);
}

export function degreesToRadians(degrees: number): number {
  return assertFiniteNumber(degrees, 'degrees') * DEG_TO_RAD;
}

export function radiansToDegrees(radians: number): number {
  return assertFiniteNumber(radians, 'radians') * RAD_TO_DEG;
}
