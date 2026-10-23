import { normalizeLongitude } from '../earthCoordinates';
import { normalizeTileX } from './tileMath';

export const EARTH_DETAIL_TILE_SIZE = 512;
export const EARTH_DETAIL_TILE_PADDING = 8;
export const EARTH_DETAIL_MIN_LEVEL = 3;
export const EARTH_DETAIL_MAX_LEVEL = 5;
export const EARTH_DETAIL_ASSET_VERSION = 'v1';
export const EARTH_DETAIL_ACTIVATION_DISTANCE = 3;
export const EARTH_DETAIL_DEACTIVATION_DISTANCE = 3.2;
export const EARTH_DETAIL_DEFAULT_MAX_TILES = 9;
export const EARTH_DETAIL_MAX_PIXEL_RATIO = 2;

export const EARTH_DETAIL_SOURCE = {
  title: 'NASA Blue Marble Next Generation, July 2004',
  author: 'NASA Earth Observatory / Reto Stöckli',
  license: 'Public domain (NASA)',
  sourceUrl:
    'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x21600x10800.jpg',
  nativeWidth: 21600,
  nativeHeight: 10800,
  bundledMaxWidth: 16384,
  bundledMaxHeight: 8192,
} as const;

export const EARTH_DETAIL_NIGHT_SOURCE = {
  title: 'NASA Black Marble 2016',
  author: 'NASA/GSFC, VIIRS Suomi NPP',
  license: 'Public domain (NASA)',
  sourceUrl:
    'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg',
  nativeWidth: 13500,
  nativeHeight: 6750,
  embeddedInTileAlpha: true,
} as const;

export interface EarthDetailTile {
  level: number;
  x: number;
  y: number;
}

export interface EarthDetailSelection {
  level: number | null;
  tiles: EarthDetailTile[];
  pixelsPerDegree: number | null;
  atMaxLevel: boolean;
}

export interface EarthDetailView {
  latitudeDeg: number;
  longitudeDeg: number;
  cameraDistance: number;
  fovDeg: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio?: number;
}

export interface EarthDetailOptions {
  maxTiles?: number;
  /** Distance from Earth's center at which the layer may activate. */
  maxCameraDistance?: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapAngleDifference(angleDeg: number, centerDeg: number): number {
  return ((((angleDeg - centerDeg + 180) % 360) + 360) % 360) - 180;
}

export function earthDetailLevelWidth(level: number): number {
  return EARTH_DETAIL_TILE_SIZE * 2 ** level;
}

export function earthDetailLevelTiles(level: number): {
  x: number;
  y: number;
  spanDeg: number;
} {
  if (!Number.isInteger(level) || level < 1 || level > 22) {
    throw new RangeError('level must be an integer between 1 and 22.');
  }
  return {
    x: 2 ** level,
    y: 2 ** (level - 1),
    spanDeg: 360 / 2 ** level,
  };
}

export function earthDetailPixelsPerDegree(level: number): number {
  return earthDetailLevelWidth(level) / 360;
}

export function earthDetailTileBounds(tile: EarthDetailTile): {
  westLon: number;
  southLat: number;
  eastLon: number;
  northLat: number;
} {
  const { x: tilesX, y: tilesY, spanDeg } = earthDetailLevelTiles(tile.level);
  if (
    !Number.isInteger(tile.x) ||
    !Number.isInteger(tile.y) ||
    tile.x < 0 ||
    tile.x >= tilesX ||
    tile.y < 0 ||
    tile.y >= tilesY
  ) {
    throw new RangeError('Invalid Earth detail tile coordinate.');
  }
  return {
    westLon: -180 + tile.x * spanDeg,
    eastLon: -180 + (tile.x + 1) * spanDeg,
    southLat: 90 - (tile.y + 1) * spanDeg,
    northLat: 90 - tile.y * spanDeg,
  };
}

export function earthDetailTileKey(tile: EarthDetailTile): string {
  return `${tile.level}/${tile.x}/${tile.y}`;
}

export function earthDetailTileUrl(baseUrl: string, tile: EarthDetailTile): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}earth-detail/${EARTH_DETAIL_ASSET_VERSION}/${tile.level}/${tile.x}/${tile.y}.webp`;
}

export function lonLatToEarthDetailTile(
  latitudeDeg: number,
  longitudeDeg: number,
  level: number,
): EarthDetailTile {
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees.');
  }
  if (!Number.isFinite(longitudeDeg)) {
    throw new RangeError('Longitude must be finite.');
  }
  const { x: tilesX, y: tilesY, spanDeg } = earthDetailLevelTiles(level);
  return {
    level,
    x: Math.floor((normalizeLongitude(longitudeDeg) + 180) / spanDeg) % tilesX,
    y: clamp(Math.floor((90 - latitudeDeg) / spanDeg), 0, tilesY - 1),
  };
}

function emptySelection(): EarthDetailSelection {
  return { level: null, tiles: [], pixelsPerDegree: null, atMaxLevel: false };
}

/**
 * Selects a bounded set of equirectangular tiles from the level whose texel
 * density first covers the rendered screen. Coverage takes precedence over
 * resolution: the level is lowered until the visible footprint fits inside
 * the tile budget. This uses the physical drawing buffer, not CSS pixels.
 */
export function selectEarthDetailTiles(
  view: EarthDetailView,
  options: EarthDetailOptions = {},
): EarthDetailSelection {
  const {
    latitudeDeg,
    longitudeDeg,
    cameraDistance,
    fovDeg,
    viewportWidth,
    viewportHeight,
    pixelRatio = 1,
  } = view;
  const maxTiles = options.maxTiles ?? EARTH_DETAIL_DEFAULT_MAX_TILES;
  const maxCameraDistance =
    options.maxCameraDistance ?? EARTH_DETAIL_ACTIVATION_DISTANCE;

  if (
    !Number.isFinite(latitudeDeg) ||
    latitudeDeg < -90 ||
    latitudeDeg > 90 ||
    !Number.isFinite(longitudeDeg)
  ) {
    throw new RangeError('Earth detail view coordinates must be valid.');
  }
  if (
    !Number.isFinite(cameraDistance) ||
    !Number.isFinite(fovDeg) ||
    fovDeg <= 0 ||
    fovDeg >= 180 ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    !Number.isFinite(pixelRatio) ||
    pixelRatio <= 0 ||
    !Number.isInteger(maxTiles) ||
    maxTiles < 1 ||
    !Number.isFinite(maxCameraDistance) ||
    maxCameraDistance <= 1
  ) {
    throw new RangeError('Invalid Earth detail camera or tile limits.');
  }

  if (cameraDistance >= maxCameraDistance || cameraDistance <= 1) {
    return emptySelection();
  }

  const height = cameraDistance - 1;
  const tanV = Math.tan((fovDeg / 2) * DEG_TO_RAD);
  const aspect = viewportWidth / viewportHeight;
  const alphaVDeg = Math.atan(height * tanV) * RAD_TO_DEG;
  const alphaHDeg = Math.atan(height * tanV * aspect) * RAD_TO_DEG;
  const effectiveRatio = Math.min(pixelRatio, EARTH_DETAIL_MAX_PIXEL_RATIO);
  const pixelsPerDegree = Math.min(
    (viewportWidth * effectiveRatio) / Math.max(2 * alphaHDeg, 1e-9),
    (viewportHeight * effectiveRatio) / Math.max(2 * alphaVDeg, 1e-9),
  );
  const desiredLevel = clamp(
    Math.ceil(
      Math.log2(
        (pixelsPerDegree * 360) / EARTH_DETAIL_TILE_SIZE,
      ),
    ),
    EARTH_DETAIL_MIN_LEVEL,
    EARTH_DETAIL_MAX_LEVEL,
  );

  const latitude = Math.max(-90, Math.min(90, latitudeDeg));
  const longitude = normalizeLongitude(longitudeDeg);
  const cosineLat = Math.max(0.15, Math.cos(latitude * DEG_TO_RAD));
  const latitudeHalf = alphaVDeg;
  const longitudeHalf = Math.min(180, alphaHDeg / cosineLat);

  for (let level = desiredLevel; level >= EARTH_DETAIL_MIN_LEVEL; level -= 1) {
    const { x: tilesX, y: tilesY, spanDeg } = earthDetailLevelTiles(level);
    const xCenter = lonLatToEarthDetailTile(latitude, longitude, level).x;
    const yStart = clamp(
      Math.floor((90 - (latitude + latitudeHalf)) / spanDeg),
      0,
      tilesY - 1,
    );
    const yEnd = clamp(
      Math.floor((90 - (latitude - latitudeHalf)) / spanDeg),
      0,
      tilesY - 1,
    );
    const xCandidates: number[] = [];
    const maxDx = Math.min(tilesX, Math.ceil(longitudeHalf / spanDeg) + 1);
    for (let dx = -maxDx; dx <= maxDx; dx += 1) {
      const x = normalizeTileX(xCenter + dx, level);
      const centerLon = -180 + (x + 0.5) * spanDeg;
      if (Math.abs(wrapAngleDifference(centerLon, longitude)) <= longitudeHalf + spanDeg / 2) {
        if (!xCandidates.includes(x)) xCandidates.push(x);
      }
    }

    const candidates: EarthDetailTile[] = [];
    for (const x of xCandidates) {
      for (let y = yStart; y <= yEnd; y += 1) {
        candidates.push({ level, x, y });
      }
    }
    if (candidates.length === 0 || candidates.length > maxTiles) {
      continue;
    }

    candidates.sort((a, b) => {
      const aLat = 90 - (a.y + 0.5) * spanDeg;
      const bLat = 90 - (b.y + 0.5) * spanDeg;
      const aLon = -180 + (a.x + 0.5) * spanDeg;
      const bLon = -180 + (b.x + 0.5) * spanDeg;
      const aDistance = Math.hypot(
        aLat - latitude,
        wrapAngleDifference(aLon, longitude) * cosineLat,
      );
      const bDistance = Math.hypot(
        bLat - latitude,
        wrapAngleDifference(bLon, longitude) * cosineLat,
      );
      return aDistance - bDistance;
    });

    return {
      level,
      tiles: candidates,
      pixelsPerDegree,
      atMaxLevel: level === EARTH_DETAIL_MAX_LEVEL,
    };
  }

  return emptySelection();
}
