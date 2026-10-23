import * as THREE from 'three';
import earthTextureUrl from '../../assets/textures/earth.webp?url';
import nightLightsTextureUrl from '../../assets/textures/night-lights.webp?url';
import moonTextureUrl from '../../assets/textures/moon.jpg?url';
import marsTextureUrl from '../../assets/textures/mars.jpg?url';
import type { ReferenceFrame } from '../../astronomy/referenceFrame';
import {
  EARTH_DISPLAY_DISTANCES,
  localDirectionToScene,
} from './earthDisplayFrame';
import {
  EARTH_CITY_LIGHT_INTENSITY,
  EARTH_SURFACE_COLOR_GLSL,
} from './earthSurfaceShader';
import { createLitBodyMaterial } from './litBodyMaterial';

export interface BodyVisual {
  id: string;
  mesh: THREE.Mesh;
  radius: number;
  position: THREE.Vector3;
}

export interface SolarSystemVisual {
  root: THREE.Group;
  bodies: Map<string, BodyVisual>;
  interactiveMeshes: THREE.Mesh[];
  earthSpinGroup: THREE.Object3D;
  earthAtmosphere: THREE.Mesh;
  earthMaterial: THREE.ShaderMaterial;
  earthDayTexture: THREE.Texture;
  earthNightTexture: THREE.Texture;
  earthSunDirection: THREE.Vector3;
  applyReferenceFrame(frame: ReferenceFrame): void;
  sunMaterial: THREE.ShaderMaterial;
  selectionRing: THREE.Sprite;
  update(elapsedSeconds: number, _deltaSeconds: number, lowPower: boolean): void;
}

function createSunGlowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,225,160,0.95)');
  gradient.addColorStop(0.48, 'rgba(255,170,70,0.38)');
  gradient.addColorStop(1, 'rgba(255,120,20,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSelectionTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  context.strokeStyle = 'rgba(150, 218, 255, 0.78)';
  context.lineWidth = 4;
  context.shadowColor = 'rgba(110, 200, 255, 0.8)';
  context.shadowBlur = 9;
  context.beginPath();
  context.arc(128, 128, 103, 0, Math.PI * 2);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadTexture(
  loader: THREE.TextureLoader,
  url: string,
  renderer: THREE.WebGLRenderer,
): Promise<THREE.Texture> {
  return loader.loadAsync(url).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  });
}

function createAtmosphere(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1.03, 64, 64);
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.6);
        gl_FragColor = vec4(vec3(0.22, 0.52, 1.0) * intensity, intensity);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

export async function createSolarSystem(
  renderer: THREE.WebGLRenderer,
): Promise<SolarSystemVisual> {
  const root = new THREE.Group();
  root.name = 'solar-system';
  const loader = new THREE.TextureLoader();
  const [earthTexture, nightLightsTexture, moonTexture, marsTexture] = await Promise.all([
    loadTexture(loader, earthTextureUrl, renderer),
    loadTexture(loader, nightLightsTextureUrl, renderer),
    loadTexture(loader, moonTextureUrl, renderer),
    loadTexture(loader, marsTextureUrl, renderer),
  ]);
  earthTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  nightLightsTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const bodies = new Map<string, BodyVisual>();
  const interactiveMeshes: THREE.Mesh[] = [];

  const earthTilt = new THREE.Group();
  earthTilt.rotation.z = THREE.MathUtils.degToRad(23.44);
  const earthSpinGroup = new THREE.Group();
  // Geographic east/west is fixed relative to the texture. The old arbitrary
  // spin moved user markers and map tiles independently of the imagery, so
  // the Earth is kept geographically stable for this foundation.
  earthSpinGroup.rotation.y = 2.1;
  const earthMaterial = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: earthTexture },
      nightMap: { value: nightLightsTexture },
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      uCityLightIntensity: { value: EARTH_CITY_LIGHT_INTENSITY },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #include <common>

      uniform sampler2D dayMap;
      uniform sampler2D nightMap;

      varying vec2 vUv;
      varying vec3 vNormal;

      ${EARTH_SURFACE_COLOR_GLSL}

      void main() {
        vec3 normal = normalize(vNormal);
        float sunDot = dot(normal, normalize(uSunDirection));
        vec3 dayColor = texture2D(dayMap, vUv).rgb;
        vec3 nightLights = texture2D(nightMap, vUv).rgb;
        vec3 color = earthSurfaceColor(dayColor, nightLights, sunDot);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 96),
    earthMaterial,
  );
  earthMesh.userData.bodyId = 'earth';
  earthSpinGroup.add(earthMesh);
  const earthAtmosphere = createAtmosphere();
  earthTilt.add(earthSpinGroup);
  earthTilt.add(earthAtmosphere);
  root.add(earthTilt);
  bodies.set('earth', { id: 'earth', mesh: earthMesh, radius: 1, position: new THREE.Vector3(0, 0, 0) });
  interactiveMeshes.push(earthMesh);

  const moonLit = createLitBodyMaterial(moonTexture);
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 64, 64),
    moonLit.material,
  );
  moonMesh.rotation.y = -0.8;
  moonMesh.userData.bodyId = 'moon';
  root.add(moonMesh);
  bodies.set('moon', {
    id: 'moon',
    mesh: moonMesh,
    radius: 0.27,
    position: new THREE.Vector3(),
  });
  interactiveMeshes.push(moonMesh);

  const sunMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPosition;
      uniform float uTime;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p *= 2.03;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 p = normalize(vPosition);
        float n = fbm(p * 5.5 + vec3(uTime * 0.018, 0.0, 0.0));
        float detail = fbm(p * 16.0 - vec3(0.0, uTime * 0.03, 0.0));
        float v = clamp(n * 0.65 + detail * 0.45, 0.0, 1.0);
        vec3 deep = vec3(0.83, 0.22, 0.015);
        vec3 bright = vec3(1.0, 0.82, 0.32);
        vec3 color = mix(deep, bright, smoothstep(0.24, 0.82, v));
        color += vec3(0.22, 0.1, 0.0) * smoothstep(0.55, 0.85, v);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    toneMapped: false,
  });

  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(3.2, 64, 64), sunMaterial);
  sunMesh.userData.bodyId = 'sun';
  root.add(sunMesh);
  bodies.set('sun', {
    id: 'sun',
    mesh: sunMesh,
    radius: 3.2,
    position: new THREE.Vector3(),
  });
  interactiveMeshes.push(sunMesh);

  const glowMaterial = new THREE.SpriteMaterial({
    map: createSunGlowTexture(),
    color: 0xffb347,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.setScalar(16);
  root.add(glow);

  const marsLit = createLitBodyMaterial(marsTexture, 0.06);
  const marsMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.53, 64, 64),
    marsLit.material,
  );
  marsMesh.rotation.z = THREE.MathUtils.degToRad(25.19);
  marsMesh.rotation.y = 0.7;
  marsMesh.userData.bodyId = 'mars';
  root.add(marsMesh);
  bodies.set('mars', {
    id: 'mars',
    mesh: marsMesh,
    radius: 0.53,
    position: new THREE.Vector3(),
  });
  interactiveMeshes.push(marsMesh);

  const selectionMaterial = new THREE.SpriteMaterial({
    map: createSelectionTexture(),
    color: 0x9adcff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const selectionRing = new THREE.Sprite(selectionMaterial);
  selectionRing.visible = false;
  root.add(selectionRing);

  const applyReferenceFrame = (frame: ReferenceFrame): void => {
    const sunDirection = localDirectionToScene(frame.sun.directionFromEarth);
    sunMesh.position.copy(sunDirection).multiplyScalar(EARTH_DISPLAY_DISTANCES.sun);
    glow.position.copy(sunMesh.position);

    const moonPosition = localDirectionToScene(frame.moon.directionFromEarth)
      .multiplyScalar(EARTH_DISPLAY_DISTANCES.moon);
    moonMesh.position.copy(moonPosition);
    bodies.get('moon')?.position.copy(moonPosition);

    const marsPosition = localDirectionToScene(frame.mars.directionFromEarth)
      .multiplyScalar(EARTH_DISPLAY_DISTANCES.mars);
    marsMesh.position.copy(marsPosition);
    bodies.get('mars')?.position.copy(marsPosition);

    const sunBody = bodies.get('sun');
    sunBody?.position.copy(sunMesh.position);
    earthMaterial.uniforms.uSunDirection!.value.set(
      frame.sun.directionFromEarth.x,
      frame.sun.directionFromEarth.y,
      frame.sun.directionFromEarth.z,
    ).normalize();

    moonLit.sunDirection.copy(
      localDirectionToScene(frame.moon.sunDirection),
    );
    marsLit.sunDirection.copy(
      localDirectionToScene(frame.mars.sunDirection),
    );
  };

  return {
    root,
    bodies,
    interactiveMeshes,
    earthSpinGroup,
    earthAtmosphere,
    earthMaterial,
    earthDayTexture: earthTexture,
    earthNightTexture: nightLightsTexture,
    earthSunDirection: earthMaterial.uniforms.uSunDirection!.value as THREE.Vector3,
    applyReferenceFrame,
    sunMaterial,
    selectionRing,
    update(elapsedSeconds: number, _deltaSeconds: number, lowPower: boolean): void {
      if (!lowPower) {
        sunMaterial.uniforms.uTime!.value = elapsedSeconds;
      }
      selectionRing.material.rotation = elapsedSeconds * 0.08;
    },
  };
}
