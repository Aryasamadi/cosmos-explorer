import * as THREE from 'three';

/**
 * Releases geometries, materials, and textures owned by an object graph.
 * Shared assets are disposed only once per tree.
 */
export function disposeObjectTree(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();

  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
      if (child.geometry) geometries.add(child.geometry);
      const materialList = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materialList) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) {
            textures.add(value);
          }
        }
      }
    }
    if (child instanceof THREE.Sprite) {
      materials.add(child.material);
      if (child.material.map) textures.add(child.material.map);
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

export function removeCanvas(canvas: HTMLCanvasElement | null): void {
  if (canvas?.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }
}
