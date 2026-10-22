import { describe, expect, it } from 'vitest';
import { createTileGeometry } from './globeTiles';

describe('globe tile surface geometry', () => {
  it('uses outward-facing winding so FrontSide tiles are visible', () => {
    const geometry = createTileGeometry({ zoom: 5, x: 19, y: 12 });
    const positions = geometry.getAttribute('position');
    const indices = geometry.getIndex();
    expect(indices).not.toBeNull();
    const aIndex = indices!.getX(0);
    const bIndex = indices!.getX(1);
    const cIndex = indices!.getX(2);
    const a = [positions.getX(aIndex), positions.getY(aIndex), positions.getZ(aIndex)];
    const b = [positions.getX(bIndex), positions.getY(bIndex), positions.getZ(bIndex)];
    const c = [positions.getX(cIndex), positions.getY(cIndex), positions.getZ(cIndex)];
    const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const ac = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const normal = [
      ab[1]! * ac[2]! - ab[2]! * ac[1]!,
      ab[2]! * ac[0]! - ab[0]! * ac[2]!,
      ab[0]! * ac[1]! - ab[1]! * ac[0]!,
    ];
    const outwardDot = normal[0]! * a[0]! + normal[1]! * a[1]! + normal[2]! * a[2]!;
    expect(outwardDot).toBeGreaterThan(0);
    geometry.dispose();
  });

  it('maps the north texture edge to the north tile edge', () => {
    const geometry = createTileGeometry({ zoom: 4, x: 8, y: 6 });
    const uvs = geometry.getAttribute('uv');
    const positions = geometry.getAttribute('position');
    // The first vertex row is the north row, with v = 1.
    expect(uvs.getY(0)).toBeCloseTo(1, 6);
    expect(positions.getY(0)).toBeGreaterThan(0);
    geometry.dispose();
  });
});
