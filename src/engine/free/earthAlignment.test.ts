import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { geodeticToUnitVector } from '../../geo/earthCoordinates';

function nearestVertexUv(
  geometry: THREE.SphereGeometry,
  expected: { x: number; y: number; z: number },
): { u: number; v: number } {
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    const distance = Math.hypot(
      positions.getX(index) - expected.x,
      positions.getY(index) - expected.y,
      positions.getZ(index) - expected.z,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return { u: uvs.getX(bestIndex), v: uvs.getY(bestIndex) };
}

describe('equirectangular Earth texture alignment', () => {
  it('aligns longitude 0 and 90 E with the standard sphere UVs', () => {
    const geometry = new THREE.SphereGeometry(1, 16, 8);
    const primeMeridian = nearestVertexUv(geometry, geodeticToUnitVector(0, 0));
    expect(primeMeridian.u).toBeCloseTo(0.5, 6);
    expect(primeMeridian.v).toBeCloseTo(0.5, 6);

    const east = nearestVertexUv(geometry, geodeticToUnitVector(0, 90));
    expect(east.u).toBeCloseTo(0.75, 6);
    expect(east.v).toBeCloseTo(0.5, 6);

    const antimeridian = nearestVertexUv(geometry, geodeticToUnitVector(0, 180));
    expect(Math.min(Math.abs(antimeridian.u), Math.abs(antimeridian.u - 1))).toBeLessThan(
      0.001,
    );
    geometry.dispose();
  });
});
