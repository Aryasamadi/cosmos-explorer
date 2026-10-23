import { describe, expect, it } from 'vitest';
import { geodeticToUnitVector } from '../../geo/earthCoordinates';
import {
  EARTH_DETAIL_MAX_LEVEL,
  earthDetailTileBounds,
  lonLatToEarthDetailTile,
} from '../../geo/tiles/earthDetail';
import { OSM_TILE_RADIUS } from './globeTiles';
import {
  EARTH_DETAIL_SURFACE_RADIUS,
  createEarthDetailGeometry,
} from './earthDetailGeometry';

function vertexAt(
  geometry: ReturnType<typeof createEarthDetailGeometry>,
  index: number,
): { x: number; y: number; z: number } {
  const positions = geometry.getAttribute('position');
  return {
    x: positions.getX(index),
    y: positions.getY(index),
    z: positions.getZ(index),
  };
}

describe('high-resolution Earth detail geometry', () => {
  it('faces outward so FrontSide tiles are visible', () => {
    const geometry = createEarthDetailGeometry({ level: 4, x: 8, y: 4 });
    const indices = geometry.getIndex()!;
    const a = vertexAt(geometry, indices.getX(0));
    const b = vertexAt(geometry, indices.getX(1));
    const c = vertexAt(geometry, indices.getX(2));
    const ab = [b.x - a.x, b.y - a.y, b.z - a.z];
    const ac = [c.x - a.x, c.y - a.y, c.z - a.z];
    const normal = [
      ab[1]! * ac[2]! - ab[2]! * ac[1]!,
      ab[2]! * ac[0]! - ab[0]! * ac[2]!,
      ab[0]! * ac[1]! - ab[1]! * ac[0]!,
    ];
    expect(normal[0]! * a.x + normal[1]! * a.y + normal[2]! * a.z).toBeGreaterThan(0);
    geometry.dispose();
  });

  it('maps the north edge to v=1 and the center to the geographic center', () => {
    const tile = { level: 5, x: 20, y: 4 };
    const bounds = earthDetailTileBounds(tile);
    const geometry = createEarthDetailGeometry(tile);
    const uvs = geometry.getAttribute('uv');
    expect(uvs.getY(0)).toBeCloseTo(1, 7);

    const positions = geometry.getAttribute('position');
    const centerIndex = Math.floor(positions.count / 2);
    const actual = vertexAt(geometry, centerIndex);
    const expected = geodeticToUnitVector(
      (bounds.northLat + bounds.southLat) / 2,
      (bounds.westLon + bounds.eastLon) / 2,
    );
    expect(actual.x / EARTH_DETAIL_SURFACE_RADIUS).toBeCloseTo(expected.x, 4);
    expect(actual.y / EARTH_DETAIL_SURFACE_RADIUS).toBeCloseTo(expected.y, 4);
    expect(actual.z / EARTH_DETAIL_SURFACE_RADIUS).toBeCloseTo(expected.z, 4);
    geometry.dispose();
  });

  it('is above the base sphere but below the OSM and marker layers', () => {
    expect(EARTH_DETAIL_SURFACE_RADIUS).toBeGreaterThan(1);
    expect(EARTH_DETAIL_SURFACE_RADIUS).toBeLessThan(OSM_TILE_RADIUS);
  });

  it('shares edge positions between neighboring tiles', () => {
    const level = 4;
    const west = createEarthDetailGeometry({ level, x: 8, y: 4 });
    const east = createEarthDetailGeometry({ level, x: 9, y: 4 });
    const westPositions = west.getAttribute('position');
    const eastPositions = east.getAttribute('position');
    const segments = Math.round(Math.sqrt(westPositions.count)) - 1;
    const westRowWidth = segments + 1;
    for (let row = 0; row <= segments; row += 1) {
      const westIndex = row * westRowWidth + segments;
      const eastIndex = row * (segments + 1);
      expect(westPositions.getX(westIndex)).toBeCloseTo(eastPositions.getX(eastIndex), 6);
      expect(westPositions.getY(westIndex)).toBeCloseTo(eastPositions.getY(eastIndex), 6);
      expect(westPositions.getZ(westIndex)).toBeCloseTo(eastPositions.getZ(eastIndex), 6);
    }
    west.dispose();
    east.dispose();
  });

  it('keeps every vertex on the intended radius', () => {
    const tile = lonLatToEarthDetailTile(35.6892, 51.389, EARTH_DETAIL_MAX_LEVEL);
    const geometry = createEarthDetailGeometry(tile);
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 128) {
      const length = Math.hypot(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index),
      );
      expect(length).toBeCloseTo(EARTH_DETAIL_SURFACE_RADIUS, 7);
    }
    geometry.dispose();
  });
});
