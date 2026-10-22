import * as THREE from 'three';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D is unavailable for the starfield texture.');
  }
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.28)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface StarfieldLayer {
  group: THREE.Group;
}

export function createStarfield(radius = 280): StarfieldLayer {
  const random = mulberry32(20261022);
  const group = new THREE.Group();
  group.name = 'procedural-starfield';

  const makeLayer = (
    count: number,
    minDistance: number,
    size: number,
    brightness: number,
    warmBias: number,
  ): THREE.Points => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const distance = minDistance + random() * (radius - minDistance);
      positions[i * 3] = distance * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = distance * cosPhi;
      positions[i * 3 + 2] = distance * sinPhi * Math.sin(theta);

      const warm = random() < warmBias;
      const value = brightness * (0.55 + random() * 0.45);
      colors[i * 3] = value;
      colors[i * 3 + 1] = value * (warm ? 0.9 : 0.95);
      colors[i * 3 + 2] = value * (warm ? 0.78 : 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: createGlowTexture(),
      alphaTest: 0.02,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  };

  group.add(makeLayer(1400, radius * 0.85, 1.1, 0.85, 0.18));
  group.add(makeLayer(130, radius * 0.8, 2.4, 1, 0.28));
  return { group };
}
