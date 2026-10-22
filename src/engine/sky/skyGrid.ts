import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { altAzToSkyVector } from '../../astronomy/coordinates/projection';

export interface SkyGrid {
  group: THREE.Group;
  setVisible(visible: boolean): void;
  setDaylight(dayFactor: number): void;
}

function createLine(
  points: THREE.Vector3[],
  opacity: number,
  color = 0xdfe9ff,
): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = -50;
  return line;
}

function createCardinalLabel(text: string, azimuthDeg: number, radius: number): CSS2DObject {
  const element = document.createElement('div');
  element.className = 'sky-cardinal-label';
  element.textContent = text;
  const label = new CSS2DObject(element);
  const vector = altAzToSkyVector({ altitudeDeg: 0.6, azimuthDeg }, radius);
  label.position.set(vector.x, vector.y, vector.z);
  return label;
}

export function createSkyGrid(radius = 175): SkyGrid {
  const group = new THREE.Group();
  group.name = 'horizontal-grid';

  for (const altitude of [15, 30, 45, 60, 75]) {
    const points: THREE.Vector3[] = [];
    for (let azimuth = 0; azimuth <= 360; azimuth += 4) {
      const vector = altAzToSkyVector({ altitudeDeg: altitude, azimuthDeg: azimuth }, radius);
      points.push(new THREE.Vector3(vector.x, vector.y, vector.z));
    }
    group.add(createLine(points, 0.075));
  }

  for (let azimuth = 0; azimuth < 360; azimuth += 30) {
    const points: THREE.Vector3[] = [];
    for (let altitude = 0; altitude <= 84; altitude += 4) {
      const vector = altAzToSkyVector({ altitudeDeg: altitude, azimuthDeg: azimuth }, radius);
      points.push(new THREE.Vector3(vector.x, vector.y, vector.z));
    }
    group.add(createLine(points, 0.055));
  }

  const horizonPoints: THREE.Vector3[] = [];
  for (let azimuth = 0; azimuth <= 360; azimuth += 2) {
    const vector = altAzToSkyVector({ altitudeDeg: 0, azimuthDeg: azimuth }, radius);
    horizonPoints.push(new THREE.Vector3(vector.x, vector.y, vector.z));
  }
  group.add(createLine(horizonPoints, 0.36, 0xf0f5ff));

  group.add(createCardinalLabel('شمال', 0, radius));
  group.add(createCardinalLabel('شرق', 90, radius));
  group.add(createCardinalLabel('جنوب', 180, radius));
  group.add(createCardinalLabel('غرب', 270, radius));

  const lineMaterials: Array<{
    material: THREE.LineBasicMaterial;
    baseOpacity: number;
  }> = [];
  group.traverse((child) => {
    if (child instanceof THREE.Line && child.material instanceof THREE.LineBasicMaterial) {
      lineMaterials.push({
        material: child.material,
        baseOpacity: child.material.opacity,
      });
    }
  });
  const nightColor = new THREE.Color(0xdfe9ff);
  const dayColor = new THREE.Color(0x1c3049);

  return {
    group,
    setVisible(visible: boolean): void {
      group.visible = visible;
    },
    setDaylight(dayFactor: number): void {
      const factor = Math.min(1, Math.max(0, dayFactor));
      for (const entry of lineMaterials) {
        entry.material.color.lerpColors(nightColor, dayColor, factor);
        entry.material.opacity = Math.min(0.55, entry.baseOpacity * (1 + factor * 2.4));
      }
    },
  };
}
