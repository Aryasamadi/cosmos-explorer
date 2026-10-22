import type { TileCoordinate } from './tileMath';

export interface RasterTileProvider {
  id: string;
  nameFa: string;
  /** https URL template with {z}, {x}, and {y} placeholders. */
  urlTemplate: string;
  attributionText: string;
  attributionUrl: string;
  policyUrl: string;
  licenceName: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  /** Minimum local cache lifetime required by the provider policy. */
  cacheMaxAgeMs: number;
  maxConcurrentRequests: number;
  /** Short, factual summary shown in the UI. */
  usageNoteFa: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * OpenStreetMap Standard raster tiles.
 *
 * Verified against the official OSMF Tile Usage Policy on 2026-10-22:
 * https://operations.osmfoundation.org/policies/tiles/
 * - no API key
 * - browser requests must keep a valid Referer
 * - visible attribution is required
 * - interactive viewing only; no bulk download, prefetch, or offline use
 * - cache tiles for at least seven days if response headers are not usable
 * - best-effort service; no SLA or guaranteed capacity
 */
export const OSM_RASTER_TILES: RasterTileProvider = {
  id: 'osm-standard',
  nameFa: 'نقشهٔ خیابانی OpenStreetMap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attributionText: '© OpenStreetMap contributors',
  attributionUrl: 'https://www.openstreetmap.org/copyright',
  policyUrl: 'https://operations.osmfoundation.org/policies/tiles/',
  licenceName: 'OpenStreetMap ODbL / tile attribution',
  minZoom: 0,
  maxZoom: 19,
  tileSize: 256,
  cacheMaxAgeMs: SEVEN_DAYS_MS,
  maxConcurrentRequests: 4,
  usageNoteFa:
    'کاشی‌ها فقط برای ناحیهٔ دیده‌شده و به‌صورت تعاملی بارگذاری می‌شوند. سرویس رایگان و بدون کلید است، اما بهترین‌تلاش و بدون تضمین ظرفیت است.',
};

export function tileUrl(
  provider: RasterTileProvider,
  tile: TileCoordinate,
): string {
  if (
    tile.zoom < provider.minZoom ||
    tile.zoom > provider.maxZoom ||
    !Number.isInteger(tile.x) ||
    !Number.isInteger(tile.y)
  ) {
    throw new RangeError('Tile is outside the provider zoom range.');
  }
  return provider.urlTemplate
    .replace('{z}', String(tile.zoom))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
}
