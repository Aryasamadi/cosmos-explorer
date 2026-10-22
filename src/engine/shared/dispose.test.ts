import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObjectTree } from './dispose';

describe('disposeObjectTree', () => {
  it('releases geometries, materials, and textures owned by the graph', () => {
    const scene = new THREE.Scene();
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const geometry = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const textureDispose = vi.spyOn(texture, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');

    disposeObjectTree(scene);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });

  it('does not dispose a shared texture twice', () => {
    const scene = new THREE.Scene();
    const texture = new THREE.Texture();
    const materialA = new THREE.MeshBasicMaterial({ map: texture });
    const materialB = new THREE.MeshBasicMaterial({ map: texture });
    scene.add(new THREE.Mesh(new THREE.BufferGeometry(), materialA));
    scene.add(new THREE.Mesh(new THREE.BufferGeometry(), materialB));
    const textureDispose = vi.spyOn(texture, 'dispose');

    disposeObjectTree(scene);

    expect(textureDispose).toHaveBeenCalledTimes(1);
  });

  it('disposes sprite and line resources as well', () => {
    const scene = new THREE.Scene();
    const spriteMaterial = new THREE.SpriteMaterial({ map: new THREE.Texture() });
    const sprite = new THREE.Sprite(spriteMaterial);
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial();
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(sprite, line);

    const spriteMaterialDispose = vi.spyOn(spriteMaterial, 'dispose');
    const spriteTextureDispose = vi.spyOn(spriteMaterial.map!, 'dispose');
    const lineGeometryDispose = vi.spyOn(lineGeometry, 'dispose');
    const lineMaterialDispose = vi.spyOn(lineMaterial, 'dispose');

    disposeObjectTree(scene);

    expect(spriteMaterialDispose).toHaveBeenCalled();
    expect(spriteTextureDispose).toHaveBeenCalled();
    expect(lineGeometryDispose).toHaveBeenCalled();
    expect(lineMaterialDispose).toHaveBeenCalled();
  });
});
