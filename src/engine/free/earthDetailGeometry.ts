import * as THREE from 'three';
import { geodeticToUnitVector } from '../../geo/earthCoordinates';
import {
  earthDetailLevelTiles,
  earthDetailTileBounds,
  type EarthDetailTile,
} from '../../geo/tiles/earthDetail';

export const EARTH_DETAIL_SURFACE_RADIUS = 1.00002;

function segmentCount(tile: EarthDetailTile): number {
  const { spanDeg } = earthDetailLevelTiles(tile.level);
  return Math.max(32, Math.ceil(spanDeg / 0.5));
}

/**
 * Builds the spherical patch for one equirectangular source tile. UVs remain
 * in the 0..1 content range; the shader adds the texture padding offsets.
 */
export function createEarthDetailGeometry(tile: EarthDetailTile): THREE.BufferGeometry {
  const bounds = earthDetailTileBounds(tile);
  const segments = segmentCount(tile);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segments; iy += 1) {
    const v = iy / segments;
    const latitude = bounds.northLat + (bounds.southLat - bounds.northLat) * v;
    for (let ix = 0; ix <= segments; ix += 1) {
      const u = ix / segments;
      const longitude = bounds.westLon + (bounds.eastLon - bounds.westLon) * u;
      const direction = geodeticToUnitVector(latitude, longitude);
      positions.push(
        direction.x * EARTH_DETAIL_SURFACE_RADIUS,
        direction.y * EARTH_DETAIL_SURFACE_RADIUS,
        direction.z * EARTH_DETAIL_SURFACE_RADIUS,
      );
      uvs.push(u, 1 - v);
    }
  }

  const row = segments + 1;
  for (let iy = 0; iy < segments; iy += 1) {
    for (let ix = 0; ix < segments; ix += 1) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
