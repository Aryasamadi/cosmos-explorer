/**
 * Independent topocentric reference positions from JPL Horizons.
 *
 * Query settings: OBSERVER ephemeris, CENTER=coord@399 (geodetic),
 * REF_SYSTEM=ICRF, APPARENT=AIRLESS, QUANTITIES=4,20.
 * Altitudes are geometric (no atmospheric refraction), in degrees.
 * Azimuths are measured clockwise from north. Ranges are in astronomical units.
 *
 * Retrieved: 2026-10-22. Used only by tests and documented in docs/testing.md.
 */
export interface ReferenceCase {
  label: string;
  utc: string;
  latitudeDeg: number;
  longitudeDeg: number;
  bodies: Record<
    'sun' | 'moon' | 'mars',
    { azimuthDeg: number; altitudeDeg: number; distanceAu: number }
  >;
}

export const JPL_REFERENCE_CASES: ReferenceCase[] = [
  {
    label: 'Tehran, 2026-01-15 09:00 UTC',
    utc: '2026-01-15T09:00:00.000Z',
    latitudeDeg: 35.6892,
    longitudeDeg: 51.389,
    bodies: {
      sun: { azimuthDeg: 184.513396, altitudeDeg: 33.087403, distanceAu: 0.98367656807526 },
      moon: { azimuthDeg: 221.056758, altitudeDeg: 12.014832, distanceAu: 0.00269281901256 },
      mars: { azimuthDeg: 185.874192, altitudeDeg: 31.780402, distanceAu: 2.39764890932854 },
    },
  },
  {
    label: 'Sydney, 2026-06-21 02:00 UTC',
    utc: '2026-06-21T02:00:00.000Z',
    latitudeDeg: -33.8688,
    longitudeDeg: 151.2093,
    bodies: {
      sun: { azimuthDeg: 359.152118, altitudeDeg: 32.686708, distanceAu: 1.01615464413761 },
      moon: { azimuthDeg: 81.940329, altitudeDeg: 6.281732, distanceAu: 0.00255947038511 },
      mars: { azimuthDeg: 319.072985, altitudeDeg: 26.187772, distanceAu: 2.1346928487707 },
    },
  },
  {
    label: 'Tehran, 2026-01-15 15:00 UTC (all below horizon)',
    utc: '2026-01-15T15:00:00.000Z',
    latitudeDeg: 35.6892,
    longitudeDeg: 51.389,
    bodies: {
      sun: { azimuthDeg: 254.77416, altitudeDeg: -15.237088, distanceAu: 0.98372688113229 },
      moon: { azimuthDeg: 267.390493, altitudeDeg: -50.538262, distanceAu: 0.00273216768086 },
      mars: { azimuthDeg: 254.430238, altitudeDeg: -16.997194, distanceAu: 2.39742778936422 },
    },
  },
];
