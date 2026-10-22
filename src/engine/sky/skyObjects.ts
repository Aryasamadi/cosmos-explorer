import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getSkyBodies } from '../../catalog/bodies';
import type { CelestialBody } from '../../catalog/types';
import { altAzToSkyVector } from '../../astronomy/coordinates/projection';
import type { SkySnapshot } from '../../astronomy/types';
import {
  createMarsMarkerTexture,
  createMoonMarkerTexture,
  createStarMarkerTexture,
  createSunMarkerTexture,
} from './markerTextures';

const SKY_RADIUS = 160;

interface SkyMarker {
  body: CelestialBody;
  group: THREE.Group;
  sprite: THREE.Sprite;
  label: CSS2DObject;
  hitArea: THREE.Mesh;
  fixedStar: boolean;
  baseOpacity: number;
}

export interface SkyObjectsLayer {
  root: THREE.Group;
  markers: Map<string, SkyMarker>;
  visibleBodyIds: Set<string>;
  update(snapshot: SkySnapshot, cameraOverlayActive: boolean): void;
  setSelected(bodyId: string | null): void;
  getHitAreas(): THREE.Object3D[];
}

function spriteScaleFor(body: CelestialBody): number {
  if (body.ephemerisTarget === 'sun') return 0.072;
  if (body.ephemerisTarget === 'moon') return 0.05;
  if (body.ephemerisTarget === 'mars') return 0.036;
  const magnitudeFact = body.facts.find(
    (fact) => fact.kind === 'quantity' && fact.id === 'apparent-magnitude',
  );
  const magnitude =
    magnitudeFact && magnitudeFact.kind === 'quantity' && typeof magnitudeFact.value === 'number'
      ? magnitudeFact.value
      : 2;
  const brightness = Math.min(1, Math.max(0, (2.6 - magnitude) / 4.2));
  return 0.017 + brightness * 0.016;
}

function textureFor(body: CelestialBody): THREE.Texture {
  if (body.ephemerisTarget === 'sun') return createSunMarkerTexture();
  if (body.ephemerisTarget === 'moon') return createMoonMarkerTexture();
  if (body.ephemerisTarget === 'mars') return createMarsMarkerTexture();
  return createStarMarkerTexture();
}

function createLabel(body: CelestialBody): CSS2DObject {
  const element = document.createElement('div');
  element.className = `sky-label ${
    body.starFix ? 'sky-label--star' : 'sky-label--body'
  }`;
  element.textContent = body.nameFa;
  element.title = body.nameEn;
  element.setAttribute('aria-hidden', 'true');
  const label = new CSS2DObject(element);
  // Offset labels before the first paint so a close conjunction (for example
  // the Sun and Mars in January 2026) does not stack two names.
  label.center.set(
    0.5,
    body.ephemerisTarget === 'sun' || body.starFix ? 1.35 : -0.35,
  );
  return label;
}

export function createSkyObjects(): SkyObjectsLayer {
  const root = new THREE.Group();
  root.name = 'sky-objects';
  const markers = new Map<string, SkyMarker>();
  const visibleBodyIds = new Set<string>();
  const labelsById = new Map<string, HTMLElement>();

  for (const body of getSkyBodies()) {
    const fixedStar = Boolean(body.starFix);
    const texture = textureFor(body);
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      sizeAttenuation: false,
      depthWrite: false,
      depthTest: false,
      blending:
        body.ephemerisTarget === 'sun' || fixedStar
          ? THREE.AdditiveBlending
          : THREE.NormalBlending,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(spriteScaleFor(body));
    sprite.renderOrder = 20;

    const group = new THREE.Group();
    group.name = `sky-marker-${body.id}`;
    group.add(sprite);
    const label = createLabel(body);
    group.add(label);

    const hitArea = new THREE.Mesh(
      new THREE.SphereGeometry(fixedStar ? 5 : 7, 8, 8),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    );
    hitArea.userData.bodyId = body.id;
    group.add(hitArea);

    root.add(group);
    markers.set(body.id, {
      body,
      group,
      sprite,
      label,
      hitArea,
      fixedStar,
      baseOpacity: 1,
    });
    labelsById.set(body.id, label.element);
  }

  let selectedBodyId: string | null = null;

  return {
    root,
    markers,
    visibleBodyIds,
    update(snapshot: SkySnapshot, cameraOverlayActive: boolean): void {
      visibleBodyIds.clear();
      const starFactor = cameraOverlayActive
        ? 0
        : Math.min(1, Math.max(0, (-snapshot.sunAltitudeDeg - 2) / 10));

      for (const marker of markers.values()) {
        const position = snapshot.positions.find(
          (candidate) => candidate.bodyId === marker.body.id,
        );
        if (!position) {
          marker.group.visible = false;
          marker.label.visible = false;
          marker.label.element.style.display = 'none';
          continue;
        }

        const vector = altAzToSkyVector(position.horizontal, SKY_RADIUS);
        marker.group.position.set(vector.x, vector.y, vector.z);

        const aboveHorizon = position.isAboveHorizon;
        let visible = aboveHorizon;
        if (marker.fixedStar) {
          visible = aboveHorizon && starFactor > 0.03;
          marker.sprite.material.opacity = 0.12 + starFactor * 0.88;
          marker.label.element.style.opacity = String(0.35 + starFactor * 0.65);
        }
        marker.group.visible = visible;
        marker.hitArea.visible = visible;
        marker.label.visible = visible;
        marker.label.element.style.display = visible ? '' : 'none';
        if (visible) {
          visibleBodyIds.add(marker.body.id);
        }
      }

      for (const [bodyId, element] of labelsById) {
        element.classList.toggle('is-selected', selectedBodyId === bodyId);
      }
    },
    setSelected(bodyId: string | null): void {
      selectedBodyId = bodyId;
      for (const [id, element] of labelsById) {
        element.classList.toggle('is-selected', id === bodyId);
      }
    },
    getHitAreas(): THREE.Object3D[] {
      return [...markers.values()]
        .filter((marker) => marker.group.visible)
        .map((marker) => marker.hitArea);
    },
  };
}

export { SKY_RADIUS };
