import type { GeoCoordinate } from '../types';

export const WEB_MERCATOR_MAX_LAT = 85.0511287798066;
export const DEFAULT_TILE_SIZE = 256;

export interface TileCoordinate {
  zoom: number;
  x: number;
  y: number;
}

export interface TileBounds {
  westLon: number;
  southLat: number;
  eastLon: number;
  northLat: number;
}

export interface TileView {
  latitudeDeg: number;
  longitudeDeg: number;
  /** Camera distance from the Earth center in display units (Earth radius = 1). */
  cameraDistance: number;
  fovDeg: number;
  viewportWidth: number;
  viewportHeight: number;
  maxZoom?: number;
  maxTiles?: number;
}

export interface GlobeTileSelection {
  zoom: number | null;
  tiles: TileCoordinate[];
  requiredTileCount: number;
  pixelsPerDegree: number | null;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const NO_TILES_DISTANCE = 3.2;
const MIN_CLOSE_HEIGHT = 0.0004;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeTileX(x: number, zoom: number): number {
  const count = 2 ** zoom;
  return ((x % count) + count) % count;
}

export function clampTileY(y: number, zoom: number): number {
  return clamp(y, 0, 2 ** zoom - 1);
}

export function tileKey(tile: TileCoordinate): string {
  return `${tile.zoom}/${tile.x}/${tile.y}`;
}

export function lonLatToTileFraction(
  latitudeDeg: number,
  longitudeDeg: number,
  zoom: number,
): { x: number; y: number } {
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees.');
  }
  if (!Number.isFinite(longitudeDeg)) throw new RangeError('Longitude must be finite.');
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 22) {
    throw new RangeError('zoom must be an integer between 0 and 22.');
  }
  const count = 2 ** zoom;
  const longitude = ((longitudeDeg + 180) % 360 + 360) % 360 - 180;
  const latitude = clamp(latitudeDeg, -WEB_MERCATOR_MAX_LAT, WEB_MERCATOR_MAX_LAT);
  const latitudeRad = latitude * DEG_TO_RAD;
  const x = ((longitude + 180) / 360) * count;
  const y =
    ((1 -
      Math.log(
        Math.tan(latitudeRad) + 1 / Math.cos(latitudeRad),
      ) /
        Math.PI) /
      2) *
    count;
  return { x, y };
}

export function lonLatToTile(
  latitudeDeg: number,
  longitudeDeg: number,
  zoom: number,
): TileCoordinate {
  const fraction = lonLatToTileFraction(latitudeDeg, longitudeDeg, zoom);
  return {
    zoom,
    x: Math.floor(fraction.x) % 2 ** zoom,
    y: clamp(Math.floor(fraction.y), 0, 2 ** zoom - 1),
  };
}

export function tileBounds(tile: TileCoordinate): TileBounds {
  if (
    !Number.isInteger(tile.zoom) ||
    !Number.isInteger(tile.x) ||
    !Number.isInteger(tile.y) ||
    tile.zoom < 0 ||
    tile.zoom > 22 ||
    tile.x < 0 ||
    tile.x >= 2 ** tile.zoom ||
    tile.y < 0 ||
    tile.y >= 2 ** tile.zoom
  ) {
    throw new RangeError('Invalid slippy-map tile coordinate.');
  }
  const count = 2 ** tile.zoom;
  const westLon = (tile.x / count) * 360 - 180;
  const eastLon = ((tile.x + 1) / count) * 360 - 180;
  const latAt = (y: number): number =>
    Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / count))) * RAD_TO_DEG;
  return {
    westLon,
    eastLon,
    northLat: latAt(tile.y),
    southLat: latAt(tile.y + 1),
  };
}

/**
 * Chooses a small, camera-driven raster tile set for the visible globe area.
 *
 * The camera is assumed to look at the Earth center (the free-explore
 * camera does). At most a 3×3 grid is requested around the nadir, matching
 * OSM's "visible viewport with modest look-ahead" policy. At wide screens
 * the zoom is lowered until that grid covers the visible angular extent, so
 * the base NASA texture remains visible beyond the requested tiles.
 */
export function selectGlobeTiles(view: TileView): GlobeTileSelection {
  const {
    latitudeDeg,
    longitudeDeg,
    cameraDistance,
    fovDeg,
    viewportWidth,
    viewportHeight,
    maxZoom = 19,
    maxTiles = 9,
  } = view;
  if (
    !Number.isFinite(latitudeDeg) ||
    !Number.isFinite(longitudeDeg) ||
    !Number.isFinite(cameraDistance)
  ) {
    throw new RangeError('Tile view coordinates must be finite.');
  }
  if (
    !Number.isFinite(fovDeg) ||
    fovDeg <= 0 ||
    fovDeg >= 180 ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    !Number.isInteger(maxZoom) ||
    maxZoom < 0 ||
    maxZoom > 22 ||
    !Number.isInteger(maxTiles) ||
    maxTiles < 1
  ) {
    throw new RangeError('Invalid camera or tile limits.');
  }

  if (cameraDistance >= NO_TILES_DISTANCE || cameraDistance <= 1) {
    return { zoom: null, tiles: [], requiredTileCount: 0, pixelsPerDegree: null };
  }

  const height = Math.max(cameraDistance - 1, MIN_CLOSE_HEIGHT);
  const halfFovRad = (fovDeg / 2) * DEG_TO_RAD;
  const tanV = Math.tan(halfFovRad);
  const aspect = viewportWidth / viewportHeight;
  const tanH = tanV * aspect;
  // Approximate ground angular half-extents for a camera looking at the center.
  const alphaVDeg = Math.atan(height * tanV) * RAD_TO_DEG;
  const alphaHDeg = Math.atan(height * tanH) * RAD_TO_DEG;
  const pixelsPerDegree = Math.min(
    viewportHeight / Math.max(2 * alphaVDeg, 1e-9),
    viewportWidth / Math.max(2 * alphaHDeg, 1e-9),
  );

  let zoom = clamp(
    Math.floor(Math.log2((360 * pixelsPerDegree) / DEFAULT_TILE_SIZE)),
    0,
    maxZoom,
  );
  const cosineLat = Math.max(0.15, Math.cos(latitudeDeg * DEG_TO_RAD));
  const requiredWidthDeg = 2 * alphaHDeg;
  const requiredHeightDeg = 2 * alphaVDeg;

  // A 3×3 grid must cover the visible extent; trade resolution for coverage.
  while (zoom > 0) {
    const tileAngular = 360 / 2 ** zoom;
    const coveredWidth = 3 * tileAngular * cosineLat;
    const coveredHeight = 3 * tileAngular;
    if (coveredWidth >= requiredWidthDeg && coveredHeight >= requiredHeightDeg) {
      break;
    }
    zoom -= 1;
  }

  const center = lonLatToTile(latitudeDeg, longitudeDeg, zoom);
  const unique = new Map<string, TileCoordinate>();
  const gridRadius = maxTiles >= 9 ? 1 : 0;
  for (let dy = -gridRadius; dy <= gridRadius; dy += 1) {
    for (let dx = -gridRadius; dx <= gridRadius; dx += 1) {
      const x = normalizeTileX(center.x + dx, zoom);
      const y = clampTileY(center.y + dy, zoom);
      const tile = { zoom, x, y };
      unique.set(tileKey(tile), tile);
      if (unique.size >= maxTiles) break;
    }
    if (unique.size >= maxTiles) break;
  }

  return {
    zoom,
    tiles: [...unique.values()],
    requiredTileCount: unique.size,
    pixelsPerDegree,
  };
}

export function tileContainsCoordinate(tile: TileCoordinate, coordinate: GeoCoordinate): boolean {
  const bounds = tileBounds(tile);
  const longitude = ((coordinate.longitudeDeg + 180) % 360 + 360) % 360 - 180;
  return (
    longitude >= bounds.westLon &&
    longitude <= bounds.eastLon &&
    coordinate.latitudeDeg <= bounds.northLat &&
    coordinate.latitudeDeg >= bounds.southLat
  );
}
