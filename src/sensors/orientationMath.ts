export type QuaternionTuple = readonly [x: number, y: number, z: number, w: number];

export interface OrientationSample {
  alphaDeg: number;
  betaDeg: number;
  gammaDeg: number;
  screenAngleDeg: number;
  absolute: boolean;
  compassHeadingDeg: number | null;
  timestampMs: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function normalizeDegrees(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('Angle must be finite.');
  }
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function normalizeSignedDegrees(value: number): number {
  const wrapped = normalizeDegrees(value);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

function multiply(a: QuaternionTuple, b: QuaternionTuple): QuaternionTuple {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function fromAxisAngle(axis: readonly [number, number, number], angleRad: number): QuaternionTuple {
  const half = angleRad / 2;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

function normalizeQuaternion(q: QuaternionTuple): QuaternionTuple {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  if (length < 1e-12) {
    return [0, 0, 0, 1];
  }
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

export function rotateVector(
  q: QuaternionTuple,
  vector: readonly [number, number, number],
): [number, number, number] {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = vector;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

/**
 * Converts W3C device-orientation angles into a three.js camera quaternion
 * for an observer standing inside the scene.
 *
 * Scene frame: +X east, +Y up, -Z north.
 * Device frame: +x right on screen, +y toward the screen top, +z out of the screen.
 *
 * When a compass heading is present (iOS Safari), it is used as the absolute
 * azimuth reference; otherwise alpha is used as provided by the browser and
 * the result may be relative to an arbitrary zero.
 */
export function buildCameraQuaternion(sample: OrientationSample): QuaternionTuple {
  const {
    alphaDeg,
    betaDeg,
    gammaDeg,
    screenAngleDeg,
    compassHeadingDeg,
  } = sample;
  if (
    !Number.isFinite(alphaDeg) ||
    !Number.isFinite(betaDeg) ||
    !Number.isFinite(gammaDeg) ||
    !Number.isFinite(screenAngleDeg)
  ) {
    throw new RangeError('Orientation sample contains non-finite angles.');
  }

  const alpha =
    compassHeadingDeg !== null && Number.isFinite(compassHeadingDeg)
      ? 360 - normalizeDegrees(compassHeadingDeg)
      : normalizeDegrees(alphaDeg);

  const qAlpha = fromAxisAngle([0, 0, 1], alpha * DEG_TO_RAD);
  const qBeta = fromAxisAngle([1, 0, 0], betaDeg * DEG_TO_RAD);
  const qGamma = fromAxisAngle([0, 1, 0], gammaDeg * DEG_TO_RAD);
  const qDevice = normalizeQuaternion(multiply(multiply(qAlpha, qBeta), qGamma));

  // Earth (X east, Y north, Z up) -> scene (X east, Y up, Z south).
  const earthToScene = fromAxisAngle([1, 0, 0], -Math.PI / 2);
  const sceneRotation = normalizeQuaternion(multiply(earthToScene, qDevice));

  // Rotate the viewport around the camera's optical axis to match the current
  // screen orientation. This changes roll, not heading.
  const screenCorrection = fromAxisAngle(
    [0, 0, 1],
    -normalizeDegrees(screenAngleDeg) * DEG_TO_RAD,
  );
  return normalizeQuaternion(multiply(sceneRotation, screenCorrection));
}

export function forwardVector(q: QuaternionTuple): [number, number, number] {
  return rotateVector(q, [0, 0, -1]);
}

export function headingDegreesFromQuaternion(q: QuaternionTuple): number {
  const [x, , z] = forwardVector(q);
  return normalizeDegrees(Math.atan2(x, -z) * RAD_TO_DEG);
}

export function pitchDegreesFromQuaternion(q: QuaternionTuple): number {
  const [, y] = forwardVector(q);
  return Math.asin(Math.min(1, Math.max(-1, y))) * RAD_TO_DEG;
}

/**
 * Applies a clockwise heading offset around the world up axis. A positive
 * offset rotates the view toward the east.
 */
export function applyHeadingOffset(q: QuaternionTuple, offsetDeg: number): QuaternionTuple {
  if (!Number.isFinite(offsetDeg)) {
    throw new RangeError('Heading offset must be finite.');
  }
  const offset = fromAxisAngle([0, 1, 0], -offsetDeg * DEG_TO_RAD);
  return normalizeQuaternion(multiply(offset, q));
}

/**
 * Builds a camera quaternion for free-look mode. Heading is measured
 * clockwise from north; pitch is positive upward.
 */
export function manualLookQuaternion(headingDeg: number, pitchDeg: number): QuaternionTuple {
  if (!Number.isFinite(headingDeg) || !Number.isFinite(pitchDeg)) {
    throw new RangeError('Manual look angles must be finite.');
  }
  const clampedPitch = Math.min(85, Math.max(-85, pitchDeg));
  const yaw = fromAxisAngle([0, 1, 0], -normalizeSignedDegrees(headingDeg) * DEG_TO_RAD);
  const pitch = fromAxisAngle([1, 0, 0], clampedPitch * DEG_TO_RAD);
  return normalizeQuaternion(multiply(yaw, pitch));
}

export function quaternionLength(q: QuaternionTuple): number {
  return Math.hypot(q[0], q[1], q[2], q[3]);
}

export function screenAngleDegrees(screenObject: Screen | undefined): number {
  const angle = screenObject?.orientation?.angle;
  if (typeof angle === 'number' && Number.isFinite(angle)) {
    return normalizeDegrees(angle);
  }
  return 0;
}
