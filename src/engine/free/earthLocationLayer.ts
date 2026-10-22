import * as THREE from 'three';
import {
  accuracyCircleLocalPoints,
  geodeticToUnitVector,
} from '../../geo/earthCoordinates';
import type { GeoLocation, LocalVector } from '../../geo/types';

const MARKER_RADIUS = 1.00009;
const ACCURACY_RADIUS = 1.000055;

function createLocationMarkerTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  const glow = context.createRadialGradient(128, 128, 6, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.15, 'rgba(188,238,255,0.98)');
  glow.addColorStop(0.42, 'rgba(70,178,255,0.42)');
  glow.addColorStop(1, 'rgba(50,140,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = 'rgba(225,248,255,0.95)';
  context.lineWidth = 5;
  context.beginPath();
  context.arc(128, 128, 34, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = 'rgba(255,255,255,0.98)';
  context.beginPath();
  context.arc(128, 128, 13, 0, Math.PI * 2);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface EarthLocationLayer {
  group: THREE.Group;
  setLocation(location: GeoLocation | null): void;
  getLocation(): GeoLocation | null;
  getLocalUnitVector(): LocalVector | null;
  dispose(): void;
}

export function createEarthLocationLayer(): EarthLocationLayer {
  const group = new THREE.Group();
  group.name = 'earth-user-location';
  group.visible = false;

  const markerMaterial = new THREE.SpriteMaterial({
    map: createLocationMarkerTexture(),
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const marker = new THREE.Sprite(markerMaterial);
  marker.scale.setScalar(0.032);
  marker.renderOrder = 12;
  group.add(marker);

  let location: GeoLocation | null = null;
  let localUnitVector: LocalVector | null = null;
  let accuracyLine: THREE.LineLoop | null = null;

  const clearAccuracyLine = (): void => {
    if (!accuracyLine) return;
    group.remove(accuracyLine);
    accuracyLine.geometry.dispose();
    const material = accuracyLine.material;
    if (Array.isArray(material)) {
      for (const item of material) item.dispose();
    } else {
      material.dispose();
    }
    accuracyLine = null;
  };

  return {
    group,
    setLocation(nextLocation: GeoLocation | null): void {
      clearAccuracyLine();
      if (!nextLocation) {
        location = null;
        localUnitVector = null;
        group.visible = false;
        return;
      }
      location = nextLocation;
      const direction = geodeticToUnitVector(
        nextLocation.latitudeDeg,
        nextLocation.longitudeDeg,
      );
      localUnitVector = direction;
      marker.position.set(
        direction.x * MARKER_RADIUS,
        direction.y * MARKER_RADIUS,
        direction.z * MARKER_RADIUS,
      );
      group.visible = true;

      if (
        nextLocation.accuracyM !== null &&
        Number.isFinite(nextLocation.accuracyM) &&
        nextLocation.accuracyM > 0 &&
        nextLocation.accuracyM <= 100_000
      ) {
        const points = accuracyCircleLocalPoints(
          nextLocation,
          nextLocation.accuracyM,
          { radius: ACCURACY_RADIUS, segments: 72 },
        );
        if (points.length > 0) {
          const geometry = new THREE.BufferGeometry().setFromPoints(
            points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
          );
          const material = new THREE.LineBasicMaterial({
            color: 0x86dcff,
            transparent: true,
            opacity: 0.78,
            depthTest: true,
            depthWrite: false,
          });
          accuracyLine = new THREE.LineLoop(geometry, material);
          accuracyLine.renderOrder = 11;
          group.add(accuracyLine);
        }
      }
    },
    getLocation(): GeoLocation | null {
      return location;
    },
    getLocalUnitVector(): LocalVector | null {
      return localUnitVector;
    },
    dispose(): void {
      clearAccuracyLine();
      markerMaterial.map?.dispose();
      markerMaterial.dispose();
      if (marker.parent === group) group.remove(marker);
      group.removeFromParent();
    },
  };
}
