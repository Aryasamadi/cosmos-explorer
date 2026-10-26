import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeMoonDisplayLight, visiblePhaseFraction } from './moonPhase';

const view = new THREE.Vector3(0, 0, 1);
const sun = new THREE.Vector3(1, 0, 0.3);

describe('moon phase display light', () => {
  it.each([0, 0.1, 0.25, 0.5, 0.75, 0.9, 1])(
    'reproduces the requested visible phase fraction %s',
    (fraction) => {
      const light = computeMoonDisplayLight(view, sun, fraction);
      expect(visiblePhaseFraction(view, light)).toBeCloseTo(fraction, 10);
    },
  );

  it('reproduces the requested phase from several camera directions', () => {
    const viewDirections = [
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0.4, -0.2, 0.9),
      new THREE.Vector3(-0.7, 0.3, 0.6),
      new THREE.Vector3(0.2, 0.95, 0.1),
    ];
    const sunDirections = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-0.3, 0.4, 0.8),
      new THREE.Vector3(0.1, -0.7, 0.4),
    ];
    for (const viewDirection of viewDirections) {
      for (const sunDirection of sunDirections) {
        const light = computeMoonDisplayLight(viewDirection, sunDirection, 0.37);
        expect(visiblePhaseFraction(viewDirection, light)).toBeCloseTo(0.37, 9);
      }
    }
  });

  it('points the bright limb toward the projected Sun direction', () => {
    const light = computeMoonDisplayLight(view, new THREE.Vector3(1, 0, 0), 0.5);
    expect(light.x).toBeGreaterThan(0.99);
    expect(light.y).toBeCloseTo(0, 10);
    expect(light.z).toBeCloseTo(0, 10);
  });

  it('handles a Sun direction parallel to the view axis', () => {
    const light = computeMoonDisplayLight(view, new THREE.Vector3(0, 0, 1), 0.5);
    expect(visiblePhaseFraction(view, light)).toBeCloseTo(0.5, 10);
    expect(light.length()).toBeCloseTo(1, 10);
  });

  it('rejects invalid vectors instead of producing a silent fallback', () => {
    expect(() =>
      computeMoonDisplayLight(new THREE.Vector3(), sun, 0.5),
    ).toThrow(/view direction/);
    expect(() =>
      computeMoonDisplayLight(view, new THREE.Vector3(), 0.5),
    ).toThrow(/Sun direction/);
  });
});
