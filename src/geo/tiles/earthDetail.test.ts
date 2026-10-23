import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EARTH_DETAIL_MAX_LEVEL,
  EARTH_DETAIL_MIN_LEVEL,
  EARTH_DETAIL_NIGHT_SOURCE,
  EARTH_DETAIL_SOURCE,
  EARTH_DETAIL_TILE_PADDING,
  EARTH_DETAIL_TILE_SIZE,
  earthDetailLevelTiles,
  earthDetailLevelWidth,
  earthDetailPixelsPerDegree,
  earthDetailTileBounds,
  earthDetailTileKey,
  earthDetailTileUrl,
  lonLatToEarthDetailTile,
  selectEarthDetailTiles,
} from './earthDetail';

const TEHRAN = { latitudeDeg: 35.6892, longitudeDeg: 51.389 };
const MOBILE = {
  ...TEHRAN,
  cameraDistance: 1.08,
  fovDeg: 52,
  viewportWidth: 390,
  viewportHeight: 844,
  pixelRatio: 2,
} as const;

describe('Earth detail source pyramid', () => {
  it('uses the documented NASA source and honest maximum resolution', () => {
    expect(EARTH_DETAIL_SOURCE.nativeWidth).toBe(21600);
    expect(EARTH_DETAIL_SOURCE.nativeHeight).toBe(10800);
    expect(EARTH_DETAIL_SOURCE.bundledMaxWidth).toBe(earthDetailLevelWidth(EARTH_DETAIL_MAX_LEVEL));
    expect(EARTH_DETAIL_SOURCE.bundledMaxHeight).toBe(
      earthDetailLevelWidth(EARTH_DETAIL_MAX_LEVEL) / 2,
    );
    expect(EARTH_DETAIL_SOURCE.license).toContain('Public domain');
    expect(EARTH_DETAIL_SOURCE.sourceUrl).toContain('nasa.gov');
    expect(EARTH_DETAIL_NIGHT_SOURCE.nativeWidth).toBe(13500);
    expect(EARTH_DETAIL_NIGHT_SOURCE.nativeHeight).toBe(6750);
    expect(EARTH_DETAIL_NIGHT_SOURCE.embeddedInTileAlpha).toBe(true);
    expect(EARTH_DETAIL_NIGHT_SOURCE.license).toContain('Public domain');
  });

  it('defines power-of-two equirectangular tile grids', () => {
    const level3 = earthDetailLevelTiles(3);
    expect(level3).toEqual({ x: 8, y: 4, spanDeg: 45 });
    const level5 = earthDetailLevelTiles(5);
    expect(level5).toEqual({ x: 32, y: 16, spanDeg: 11.25 });
    expect(earthDetailPixelsPerDegree(5)).toBeCloseTo(45.511, 3);
  });

  it('maps Tehran into a tile whose bounds contain it', () => {
    for (const level of [3, 4, 5]) {
      const tile = lonLatToEarthDetailTile(TEHRAN.latitudeDeg, TEHRAN.longitudeDeg, level);
      const bounds = earthDetailTileBounds(tile);
      expect(TEHRAN.longitudeDeg).toBeGreaterThanOrEqual(bounds.westLon);
      expect(TEHRAN.longitudeDeg).toBeLessThanOrEqual(bounds.eastLon);
      expect(TEHRAN.latitudeDeg).toBeGreaterThanOrEqual(bounds.southLat);
      expect(TEHRAN.latitudeDeg).toBeLessThanOrEqual(bounds.northLat);
    }
  });

  it('wraps the antimeridian into valid tile coordinates', () => {
    for (const coordinate of [
      { latitudeDeg: 12, longitudeDeg: 179.999 },
      { latitudeDeg: -12, longitudeDeg: -179.999 },
      { latitudeDeg: 84, longitudeDeg: 180 },
    ]) {
      for (const level of [3, 4, 5]) {
        const tile = lonLatToEarthDetailTile(
          coordinate.latitudeDeg,
          coordinate.longitudeDeg,
          level,
        );
        const { x, y } = earthDetailLevelTiles(level);
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.x).toBeLessThan(x);
        expect(tile.y).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeLessThan(y);
      }
    }
  });

  it('builds versioned same-origin WebP URLs for both base conventions', () => {
    const tile = { level: 5, x: 20, y: 4 };
    expect(earthDetailTileKey(tile)).toBe('5/20/4');
    expect(earthDetailTileUrl('./', tile)).toBe('./earth-detail/v1/5/20/4.webp');
    expect(earthDetailTileUrl('/cosmos-explorer', tile)).toBe(
      '/cosmos-explorer/earth-detail/v1/5/20/4.webp',
    );
  });

  it('ships the base image and sampled tiles with the expected dimensions', () => {
    const projectRoot = resolve(process.cwd());
    const base = resolve(projectRoot, 'src/assets/textures/earth.webp');
    expect(existsSync(base)).toBe(true);
    expect(statSync(base).size).toBeGreaterThan(100_000);
    const nightBase = resolve(projectRoot, 'src/assets/textures/night-lights.webp');
    expect(existsSync(nightBase)).toBe(true);
    expect(statSync(nightBase).size).toBeGreaterThan(10_000);

    const detailRoot = resolve(projectRoot, 'public/earth-detail/v1');
    for (const level of [3, 4, 5]) {
      const { x, y } = earthDetailLevelTiles(level);
      const levelDir = resolve(detailRoot, String(level));
      expect(readdirSync(levelDir)).toHaveLength(x);
      for (const column of readdirSync(levelDir)) {
        expect(readdirSync(resolve(levelDir, column))).toHaveLength(y);
      }
      const sample = resolve(detailRoot, String(level), '0', '0.webp');
      expect(existsSync(sample)).toBe(true);
      expect(statSync(sample).size).toBeGreaterThan(1_000);
    }
    const nightSample = readFileSync(
      resolve(detailRoot, String(EARTH_DETAIL_MAX_LEVEL), '9', '4.webp'),
    );
    expect(nightSample.includes(Buffer.from('ALPH'))).toBe(true);
  });

  it('declares the padding used by the asset generator', () => {
    expect(EARTH_DETAIL_TILE_PADDING).toBe(8);
    expect(EARTH_DETAIL_TILE_SIZE).toBe(512);
    expect(EARTH_DETAIL_MIN_LEVEL).toBe(3);
  });
});

describe('screen-space Earth detail LOD', () => {
  it('selects the maximum bundled level at the focus distance', () => {
    const selection = selectEarthDetailTiles(MOBILE);
    expect(selection.level).toBe(EARTH_DETAIL_MAX_LEVEL);
    expect(selection.atMaxLevel).toBe(true);
    expect(selection.tiles.length).toBeGreaterThan(0);
    expect(selection.tiles.length).toBeLessThanOrEqual(9);
    expect(selection.tiles.every((tile) => tile.level === selection.level)).toBe(true);
    const centerTile = lonLatToEarthDetailTile(
      MOBILE.latitudeDeg,
      MOBILE.longitudeDeg,
      selection.level ?? 3,
    );
    expect(selection.tiles.map(earthDetailTileKey)).toContain(earthDetailTileKey(centerTile));
  });

  it('does not start loading detail at the overview distance', () => {
    expect(
      selectEarthDetailTiles({ ...MOBILE, cameraDistance: 7.4 }),
    ).toMatchObject({ level: null, tiles: [], atMaxLevel: false });
  });

  it('uses fewer levels as the camera pulls away', () => {
    const close = selectEarthDetailTiles({ ...MOBILE, cameraDistance: 1.02 });
    const middle = selectEarthDetailTiles({ ...MOBILE, cameraDistance: 2.2 });
    const far = selectEarthDetailTiles({ ...MOBILE, cameraDistance: 2.98 });
    expect(close.level ?? 0).toBeGreaterThanOrEqual(middle.level ?? 0);
    expect(middle.level ?? 0).toBeGreaterThanOrEqual(far.level ?? 0);
    expect(far.level).not.toBeNull();
  });

  it('honors the tile budget and keeps a bounded, deduplicated set', () => {
    for (const cameraDistance of [1.02, 1.2, 1.5, 2.2, 2.8]) {
      const selection = selectEarthDetailTiles({ ...MOBILE, cameraDistance }, { maxTiles: 6 });
      expect(selection.tiles.length).toBeLessThanOrEqual(6);
      const keys = selection.tiles.map(earthDetailTileKey);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('raises resolution for higher-density drawing buffers', () => {
    const css = selectEarthDetailTiles({
      ...MOBILE,
      cameraDistance: 2.2,
      pixelRatio: 1,
    });
    const retina = selectEarthDetailTiles({
      ...MOBILE,
      cameraDistance: 2.2,
      pixelRatio: 2,
    });
    expect(retina.pixelsPerDegree ?? 0).toBeGreaterThan(css.pixelsPerDegree ?? 0);
    expect(retina.level ?? 0).toBeGreaterThanOrEqual(css.level ?? 0);
  });

  it('selects tiles on both sides of the antimeridian', () => {
    const selection = selectEarthDetailTiles({
      ...MOBILE,
      latitudeDeg: 12,
      longitudeDeg: 179.99,
      cameraDistance: 1.4,
    });
    expect(selection.level).not.toBeNull();
    const xValues = new Set(selection.tiles.map((tile) => tile.x));
    expect(xValues.size).toBeGreaterThan(1);
    expect(selection.tiles.some((tile) => tile.x === 0)).toBe(true);
    expect(selection.tiles.some((tile) => tile.x === 2 ** (selection.level ?? 0) - 1)).toBe(
      true,
    );
  });

  it('never returns hidden or out-of-range tiles', () => {
    const selection = selectEarthDetailTiles(MOBILE);
    for (const tile of selection.tiles) {
      const { x, y } = earthDetailLevelTiles(tile.level);
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(x);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(y);
    }
  });

  it('respects activation hysteresis and input validation', () => {
    const beyond = selectEarthDetailTiles({
      ...MOBILE,
      cameraDistance: 3.05,
      pixelRatio: 1,
    });
    expect(beyond.level).toBeNull();
    expect(() =>
      selectEarthDetailTiles({ ...MOBILE, viewportWidth: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      selectEarthDetailTiles({ ...MOBILE, cameraDistance: Number.NaN }),
    ).toThrow(RangeError);
  });
});
