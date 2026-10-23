import type { GeoCoordinate } from '../types';

export const WEB_MERCATOR_MAX_LAT = 85.0511287798066;
export const DEFAULT_TILE_SIZE = 256;
const MAX_VIEW_PIXEL_RATIO = 2;

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
  pixelRatio?: number;
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

function wrapLongitudeDifference(longitudeDeg: number, centerDeg: number): number {
  return ((((longitudeDeg - centerDeg + 180) % 360) + 360) % 360) - 180;
}

/**
 * Chooses a bounded, camera-driven raster tile set for the visible globe area.
 *
 * The camera is assumed to look at the Earth center (the free-explore camera
 * does). The zoom follows the physical drawing-buffer density, then is lowered
 * until all tiles intersecting the viewport fit the request budget. Only
 * visible/near-visible tiles are requested; there is no multi-level prefetch.
 * At wide screens the base NASA texture remains visible beyond the tile set.
 */
export function selectGlobeTiles(view: TileView): GlobeTileSelection {
  const {
    latitudeDeg,
    longitudeDeg,
    cameraDistance,
    fovDeg,
    viewportWidth,
    viewportHeight,
    pixelRatio = 1,
    maxZoom = 19,
    maxTiles = 16,
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
    !Number.isFinite(pixelRatio) ||
    pixelRatio <= 0 ||
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
  const effectivePixelRatio = Math.min(pixelRatio, MAX_VIEW_PIXEL_RATIO);
  const pixelsPerDegree = Math.min(
    (viewportHeight * effectivePixelRatio) / Math.max(2 * alphaVDeg, 1e-9),
    (viewportWidth * effectivePixelRatio) / Math.max(2 * alphaHDeg, 1e-9),
  );

  let zoom = clamp(
    Math.floor(Math.log2((360 * pixelsPerDegree) / DEFAULT_TILE_SIZE)),
    0,
    maxZoom,
  );
  const latitude = clamp(latitudeDeg, -WEB_MERCATOR_MAX_LAT, WEB_MERCATOR_MAX_LAT);
  const cosineLat = Math.max(0.15, Math.cos(latitude * DEG_TO_RAD));
  const longitudeHalfDeg = Math.min(180, alphaHDeg / cosineLat);
  const northLat = clamp(
    latitude + alphaVDeg,
    -WEB_MERCATOR_MAX_LAT,
    WEB_MERCATOR_MAX_LAT,
  );
  const southLat = clamp(
    latitude - alphaVDeg,
    -WEB_MERCATOR_MAX_LAT,
    WEB_MERCATOR_MAX_LAT,
  );

  for (; zoom >= 0; zoom -= 1) {
    const spanLonDeg = 360 / 2 ** zoom;
    const center = lonLatToTile(latitude, longitudeDeg, zoom);
    const yStart = lonLatToTile(northLat, longitudeDeg, zoom).y;
    const yEnd = lonLatToTile(southLat, longitudeDeg, zoom).y;
    const xCandidates: number[] = [];
    const maxDx = Math.min(2 ** zoom, Math.ceil(longitudeHalfDeg / spanLonDeg) + 1);
    for (let dx = -maxDx; dx <= maxDx; dx += 1) {
      const x = normalizeTileX(center.x + dx, zoom);
      const centerLon = (x + 0.5) * spanLonDeg - 180;
      if (
        Math.abs(wrapLongitudeDifference(centerLon, longitudeDeg)) <=
        longitudeHalfDeg + spanLonDeg / 2
      ) {
        if (!xCandidates.includes(x)) xCandidates.push(x);
      }
    }

    const candidates: TileCoordinate[] = [];
    for (const x of xCandidates) {
      for (let y = yStart; y <= yEnd; y += 1) {
        candidates.push({ zoom, x, y: clampTileY(y, zoom) });
      }
    }
    if (candidates.length === 0 || candidates.length > maxTiles) continue;

    const centerY = center.y;
    candidates.sort((a, b) => {
      const aDx = Math.abs(wrapLongitudeDifference(a.x, center.x));
      const bDx = Math.abs(wrapLongitudeDifference(b.x, center.x));
      const aDistance = Math.hypot(aDx, a.y - centerY);
      const bDistance = Math.hypot(bDx, b.y - centerY);
      return aDistance - bDistance;
    });
    const unique = new Map<string, TileCoordinate>();
    for (const tile of candidates) unique.set(tileKey(tile), tile);

    return {
      zoom,
      tiles: [...unique.values()],
      requiredTileCount: unique.size,
      pixelsPerDegree,
    };
  }

  return { zoom: null, tiles: [], requiredTileCount: 0, pixelsPerDegree };
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
