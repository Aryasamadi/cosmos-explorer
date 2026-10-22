import { describe, expect, it } from 'vitest';
import {
  lonLatToTile,
  lonLatToTileFraction,
  normalizeTileX,
  selectGlobeTiles,
  tileBounds,
  tileContainsCoordinate,
  tileKey,
  WEB_MERCATOR_MAX_LAT,
} from './tileMath';
import { OSM_RASTER_TILES, tileUrl } from './tileProvider';

describe('slippy-map tile math', () => {
  it('defines the zoom-zero world and Mercator bounds', () => {
    const bounds = tileBounds({ zoom: 0, x: 0, y: 0 });
    expect(bounds.westLon).toBe(-180);
    expect(bounds.eastLon).toBe(180);
    expect(bounds.northLat).toBeCloseTo(WEB_MERCATOR_MAX_LAT, 8);
    expect(bounds.southLat).toBeCloseTo(-WEB_MERCATOR_MAX_LAT, 8);
    expect(lonLatToTile(0, 0, 0)).toEqual({ zoom: 0, x: 0, y: 0 });
    expect(lonLatToTile(89, 179, 0)).toEqual({ zoom: 0, x: 0, y: 0 });
  });

  it('maps coordinates into tiles that contain the coordinate', () => {
    const samples = [
      { latitudeDeg: 35.6892, longitudeDeg: 51.389 },
      { latitudeDeg: -33.8688, longitudeDeg: 151.2093 },
      { latitudeDeg: 51.5074, longitudeDeg: -0.1278 },
      { latitudeDeg: 0, longitudeDeg: 0 },
      { latitudeDeg: -84, longitudeDeg: 179.5 },
      { latitudeDeg: 84, longitudeDeg: -179.5 },
    ];
    for (const zoom of [0, 1, 2, 6, 10, 15]) {
      for (const coordinate of samples) {
        const tile = lonLatToTile(
          coordinate.latitudeDeg,
          coordinate.longitudeDeg,
          zoom,
        );
        expect(tile.zoom).toBe(zoom);
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.x).toBeLessThan(2 ** zoom);
        expect(tile.y).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeLessThan(2 ** zoom);
        expect(tileContainsCoordinate(tile, coordinate)).toBe(true);
      }
    }
  });

  it('wraps longitude and clamps Mercator latitude', () => {
    expect(normalizeTileX(-1, 2)).toBe(3);
    expect(normalizeTileX(4, 2)).toBe(0);
    // 180 degrees wraps to -180 and therefore maps to the west edge.
    const east = lonLatToTileFraction(0, 180, 1);
    expect(east.x).toBeCloseTo(0, 8);
    const west = lonLatToTileFraction(0, -180, 1);
    expect(west.x).toBeCloseTo(0, 8);
    const north = lonLatToTileFraction(89, 0, 1);
    expect(north.y).toBeCloseTo(0, 8);
    const south = lonLatToTileFraction(-89, 0, 1);
    expect(south.y).toBeCloseTo(2, 8);
    expect(lonLatToTile(89, 0, 2).y).toBe(0);
    expect(lonLatToTile(-89, 0, 2).y).toBe(3);
  });

  it('uses unique stable keys and rejects invalid tiles', () => {
    expect(tileKey({ zoom: 3, x: 4, y: 5 })).toBe('3/4/5');
    expect(() => tileBounds({ zoom: 2, x: 4, y: 0 })).toThrow(RangeError);
    expect(() => lonLatToTile(0, 0, 1.5)).toThrow(RangeError);
  });
});

describe('camera-driven globe LOD', () => {
  const baseView = {
    latitudeDeg: 35.6892,
    longitudeDeg: 51.389,
    cameraDistance: 1.2,
    fovDeg: 52,
    viewportWidth: 390,
    viewportHeight: 844,
    maxZoom: 19,
  } as const;

  it('does not request tiles while the camera is at overview distance', () => {
    const selection = selectGlobeTiles({ ...baseView, cameraDistance: 7.4 });
    expect(selection.zoom).toBeNull();
    expect(selection.tiles).toEqual([]);
  });

  it('requests a bounded 3x3 tile set near the visible area', () => {
    const selection = selectGlobeTiles(baseView);
    expect(selection.zoom).not.toBeNull();
    expect(selection.tiles.length).toBeGreaterThan(0);
    expect(selection.tiles.length).toBeLessThanOrEqual(9);
    const keys = selection.tiles.map(tileKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(selection.tiles.every((tile) => tile.zoom === selection.zoom)).toBe(true);
    const center = lonLatToTile(
      baseView.latitudeDeg,
      baseView.longitudeDeg,
      selection.zoom ?? 0,
    );
    expect(
      selection.tiles.some(
        (tile) => tile.x === center.x && tile.y === center.y,
      ),
    ).toBe(true);
  });

  it('increases requested zoom as the camera approaches the surface', () => {
    const far = selectGlobeTiles({ ...baseView, cameraDistance: 2.2 });
    const near = selectGlobeTiles({ ...baseView, cameraDistance: 1.08 });
    const close = selectGlobeTiles({ ...baseView, cameraDistance: 1.002 });
    expect(far.zoom).not.toBeNull();
    expect(near.zoom).not.toBeNull();
    expect(close.zoom).not.toBeNull();
    expect(near.zoom ?? 0).toBeGreaterThan(far.zoom ?? 0);
    expect(close.zoom ?? 0).toBeGreaterThan(near.zoom ?? 0);
    expect(close.tiles.length).toBeLessThanOrEqual(9);
  });

  it('reduces zoom for wide screens to preserve bounded coverage', () => {
    const portrait = selectGlobeTiles(baseView);
    const landscape = selectGlobeTiles({
      ...baseView,
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    expect(portrait.zoom).not.toBeNull();
    expect(landscape.zoom).not.toBeNull();
    expect(landscape.zoom ?? 0).toBeLessThanOrEqual(portrait.zoom ?? 0);
    expect(landscape.tiles.length).toBeLessThanOrEqual(9);
  });

  it('clamps requested zoom to the provider maximum', () => {
    const selection = selectGlobeTiles({
      ...baseView,
      cameraDistance: 1.00001,
      maxZoom: 7,
    });
    expect(selection.zoom).toBe(7);
  });

  it('handles antimeridian longitude without invalid tiles', () => {
    const selection = selectGlobeTiles({
      ...baseView,
      latitudeDeg: 0,
      longitudeDeg: 179.99,
      cameraDistance: 1.1,
    });
    expect(selection.tiles.length).toBeGreaterThan(0);
    for (const tile of selection.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(2 ** (selection.zoom ?? 0));
    }
  });

  it('rejects invalid camera inputs', () => {
    expect(() =>
      selectGlobeTiles({ ...baseView, viewportWidth: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      selectGlobeTiles({ ...baseView, fovDeg: Number.NaN }),
    ).toThrow(RangeError);
  });
});

describe('OSM tile provider metadata', () => {
  it('uses the documented HTTPS endpoint without a key', () => {
    expect(OSM_RASTER_TILES.urlTemplate).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(OSM_RASTER_TILES.urlTemplate).not.toContain('key=');
    expect(OSM_RASTER_TILES.attributionText).toBe('© OpenStreetMap contributors');
    expect(OSM_RASTER_TILES.attributionUrl).toContain('openstreetmap.org/copyright');
    expect(OSM_RASTER_TILES.policyUrl).toContain('operations.osmfoundation.org');
    expect(OSM_RASTER_TILES.maxZoom).toBe(19);
    expect(OSM_RASTER_TILES.cacheMaxAgeMs).toBeGreaterThanOrEqual(
      7 * 24 * 60 * 60 * 1000,
    );
  });

  it('builds provider URLs and rejects out-of-range tiles', () => {
    expect(tileUrl(OSM_RASTER_TILES, { zoom: 6, x: 39, y: 26 })).toBe(
      'https://tile.openstreetmap.org/6/39/26.png',
    );
    expect(() =>
      tileUrl(OSM_RASTER_TILES, { zoom: 20, x: 0, y: 0 }),
    ).toThrow(RangeError);
  });
});
