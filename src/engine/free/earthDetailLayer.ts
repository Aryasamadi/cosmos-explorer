import * as THREE from 'three';
import {
  EARTH_DETAIL_ACTIVATION_DISTANCE,
  EARTH_DETAIL_DEACTIVATION_DISTANCE,
  EARTH_DETAIL_DEFAULT_MAX_TILES,
  EARTH_DETAIL_TILE_PADDING,
  EARTH_DETAIL_TILE_SIZE,
  earthDetailTileBounds,
  earthDetailTileKey,
  earthDetailTileUrl,
  selectEarthDetailTiles,
  type EarthDetailSelection,
  type EarthDetailTile,
} from '../../geo/tiles/earthDetail';
import { createEarthDetailGeometry } from './earthDetailGeometry';
import {
  EARTH_CITY_LIGHT_INTENSITY,
  EARTH_SURFACE_COLOR_GLSL,
} from './earthSurfaceShader';

const CAMERA_SETTLE_MS = 260;
const FADE_DURATION_MS = 220;
const RETIRE_DELAY_MS = 360;
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_CACHED_TEXTURES = 18;
const TEXTURE_SIZE = EARTH_DETAIL_TILE_SIZE + EARTH_DETAIL_TILE_PADDING * 2;
const CONTENT_UV_SCALE = EARTH_DETAIL_TILE_SIZE / TEXTURE_SIZE;
const CONTENT_UV_OFFSET = EARTH_DETAIL_TILE_PADDING / TEXTURE_SIZE;
const ACTIVE_RENDER_ORDER = 3;
const RETIRING_RENDER_ORDER = 2;

const VERTEX_SHADER = `
  uniform vec4 uGlobalUvTransform;

  varying vec2 vUv;
  varying vec2 vGlobalUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vGlobalUv = uv * uGlobalUvTransform.xy + uGlobalUvTransform.zw;
    vNormal = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  #include <common>

  uniform sampler2D dayMap;
  uniform sampler2D baseDayMap;
  uniform sampler2D nightMap;
  uniform vec4 uDetailUvTransform;
  uniform float uFade;

  varying vec2 vUv;
  varying vec2 vGlobalUv;
  varying vec3 vNormal;

  ${EARTH_SURFACE_COLOR_GLSL}

  void main() {
    vec3 normal = normalize(vNormal);
    float sunDot = dot(normal, normalize(uSunDirection));
    vec2 detailUv = vUv * uDetailUvTransform.xy + uDetailUvTransform.zw;
    vec4 detailSample = texture2D(dayMap, detailUv);
    vec3 detailLights = vec3(pow(detailSample.a, 2.2) * 0.65);
    vec3 detail = earthSurfaceColor(detailSample.rgb, detailLights, sunDot);

    vec3 color = detail;
    if (uFade < 0.999) {
      vec3 base = earthSurfaceColor(
        texture2D(baseDayMap, vGlobalUv).rgb,
        texture2D(nightMap, vGlobalUv).rgb,
        sunDot
      );
      color = mix(base, detail, uFade);
    }

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export type EarthDetailPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface EarthDetailStatus {
  phase: EarthDetailPhase;
  level: number | null;
  loadedTiles: number;
  failedTiles: number;
  desiredTiles: number;
  atMaxLevel: boolean;
}

export interface EarthDetailLayerOptions {
  renderer: THREE.WebGLRenderer;
  baseDayTexture: THREE.Texture;
  baseNightTexture: THREE.Texture;
  sunDirection: THREE.Vector3;
  baseUrl: string;
  onStatus?: (status: EarthDetailStatus) => void;
  maxTiles?: number;
}

export interface EarthDetailLayer {
  group: THREE.Group;
  update(input: {
    camera: THREE.PerspectiveCamera;
    earthGroup: THREE.Object3D;
    target: THREE.Vector3;
    viewportWidth: number;
    viewportHeight: number;
    pixelRatio: number;
    allowSelection: boolean;
  }): void;
  dispose(): void;
}

interface CachedTexture {
  texture: THREE.Texture;
  lastUsed: number;
}

interface DetailSlot {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  fadeStartMs: number | null;
}

interface PendingRequest {
  promise: Promise<void>;
  controller: AbortController;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error('The detail request was cancelled.');
  error.name = 'AbortError';
  throw error;
}

function sameKeys(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const key of left) {
    if (!right.has(key)) return false;
  }
  return true;
}

function easeInOut(value: number): number {
  return value * value * (3 - 2 * value);
}

export function createEarthDetailLayer(
  options: EarthDetailLayerOptions,
): EarthDetailLayer {
  const root = new THREE.Group();
  root.name = 'earth-high-resolution';
  const maxTiles = options.maxTiles ?? EARTH_DETAIL_DEFAULT_MAX_TILES;
  const textureLoader = new THREE.TextureLoader();
  const textures = new Map<string, CachedTexture>();
  const pending = new Map<string, PendingRequest>();
  const controllers = new Map<string, AbortController>();
  const desiredKeys = new Set<string>();
  const failedKeys = new Set<string>();
  const queue: EarthDetailTile[] = [];

  let activeGroup: THREE.Group | null = null;
  let activeSlots = new Map<string, DetailSlot>();
  let incomingGroup: THREE.Group | null = null;
  let incomingSlots = new Map<string, DetailSlot>();
  let retiringGroup: THREE.Group | null = null;
  let retiringSlots = new Map<string, DetailSlot>();
  let retiringAtMs = 0;
  let incomingGeneration = 0;
  let activeLoads = 0;
  let currentLevel: number | null = null;
  let atMaxLevel = false;
  let signature = '';
  let lastCameraSignature = '';
  let lastCameraChangeAt = 0;
  let lastStatus = '';
  let disposed = false;

  const notify = (phase: EarthDetailPhase): void => {
    if (disposed || !options.onStatus) return;
    let loadedTiles = 0;
    for (const key of desiredKeys) {
      if (incomingSlots.has(key) || activeSlots.has(key)) loadedTiles += 1;
    }
    const failedTiles = [...desiredKeys].filter((key) => failedKeys.has(key)).length;
    const status: EarthDetailStatus = {
      phase,
      level: currentLevel,
      loadedTiles,
      failedTiles,
      desiredTiles: desiredKeys.size,
      atMaxLevel,
    };
    const statusKey = [
      phase,
      status.level,
      status.loadedTiles,
      status.failedTiles,
      status.desiredTiles,
      status.atMaxLevel,
    ].join(':');
    if (statusKey === lastStatus) return;
    lastStatus = statusKey;
    options.onStatus(status);
  };

  const inUseTextureKeys = (): Set<string> => {
    const keys = new Set<string>();
    for (const key of activeSlots.keys()) keys.add(key);
    for (const key of incomingSlots.keys()) keys.add(key);
    for (const key of retiringSlots.keys()) keys.add(key);
    return keys;
  };

  const trimTextureCache = (): void => {
    if (textures.size <= MAX_CACHED_TEXTURES) return;
    const inUse = inUseTextureKeys();
    const candidates = [...textures.entries()]
      .filter(([key]) => !inUse.has(key))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key, cached] of candidates) {
      if (textures.size <= MAX_CACHED_TEXTURES) break;
      cached.texture.dispose();
      textures.delete(key);
    }
  };

  const disposeGroup = (
    group: THREE.Group,
    slots: Map<string, DetailSlot>,
  ): void => {
    for (const slot of slots.values()) {
      group.remove(slot.mesh);
      slot.mesh.geometry.dispose();
      slot.material.dispose();
    }
    slots.clear();
    group.removeFromParent();
  };

  const disposeRetiring = (): void => {
    if (!retiringGroup) return;
    disposeGroup(retiringGroup, retiringSlots);
    retiringGroup = null;
    retiringSlots = new Map();
    retiringAtMs = 0;
    trimTextureCache();
  };

  const disposeIncoming = (): void => {
    if (!incomingGroup) return;
    disposeGroup(incomingGroup, incomingSlots);
    incomingGroup = null;
    incomingSlots = new Map();
  };

  const disposeAllTextures = (): void => {
    for (const cached of textures.values()) cached.texture.dispose();
    textures.clear();
  };

  const abortIncomingRequests = (): void => {
    incomingGeneration += 1;
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
    pending.clear();
    queue.length = 0;
  };

  const clear = (): void => {
    abortIncomingRequests();
    disposeIncoming();
    if (activeGroup) {
      disposeGroup(activeGroup, activeSlots);
      activeGroup = null;
      activeSlots = new Map();
    }
    disposeRetiring();
    disposeAllTextures();
    desiredKeys.clear();
    failedKeys.clear();
    currentLevel = null;
    atMaxLevel = false;
    signature = '';
    lastCameraSignature = '';
    lastCameraChangeAt = 0;
    notify('idle');
  };

  const createMaterial = (tile: EarthDetailTile, texture: THREE.Texture): THREE.ShaderMaterial => {
    const bounds = earthDetailTileBounds(tile);
    const spanDeg = bounds.eastLon - bounds.westLon;
    return new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: texture },
        baseDayMap: { value: options.baseDayTexture },
        nightMap: { value: options.baseNightTexture },
        uSunDirection: { value: options.sunDirection },
        uCityLightIntensity: { value: EARTH_CITY_LIGHT_INTENSITY },
        uDetailUvTransform: {
          value: new THREE.Vector4(
            CONTENT_UV_SCALE,
            CONTENT_UV_SCALE,
            CONTENT_UV_OFFSET,
            CONTENT_UV_OFFSET,
          ),
        },
        uGlobalUvTransform: {
          value: new THREE.Vector4(
            spanDeg / 360,
            spanDeg / 180,
            (bounds.westLon + 180) / 360,
            (bounds.northLat + 90) / 180 - spanDeg / 180,
          ),
        },
        uFade: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  };

  const addIncomingMesh = (tile: EarthDetailTile, texture: THREE.Texture): void => {
    if (!incomingGroup || incomingSlots.size >= maxTiles) return;
    const key = earthDetailTileKey(tile);
    if (incomingSlots.has(key) || !desiredKeys.has(key)) return;
    const material = createMaterial(tile, texture);
    const mesh = new THREE.Mesh(createEarthDetailGeometry(tile), material);
    mesh.renderOrder = ACTIVE_RENDER_ORDER;
    mesh.userData.detailTile = key;
    incomingGroup.add(mesh);
    incomingSlots.set(key, { mesh, material, fadeStartMs: null });
  };

  const revealIncoming = (now: number): void => {
    if (!incomingGroup || incomingSlots.size === 0) return;
    disposeRetiring();
    const hadActive = activeSlots.size > 0 && activeGroup !== null;
    if (activeGroup) {
      for (const slot of activeSlots.values()) {
        slot.mesh.renderOrder = RETIRING_RENDER_ORDER;
        slot.material.depthWrite = false;
      }
      retiringGroup = activeGroup;
      retiringSlots = activeSlots;
      retiringAtMs = now + RETIRE_DELAY_MS;
    }

    for (const slot of incomingSlots.values()) {
      const fade = slot.material.uniforms.uFade!.value as number;
      if (hadActive) {
        slot.material.uniforms.uFade!.value = 1;
        slot.fadeStartMs = null;
      } else if (fade <= 0) {
        slot.fadeStartMs = now;
      }
    }
    incomingGroup.visible = true;
    activeGroup = incomingGroup;
    activeSlots = incomingSlots;
    incomingGroup = null;
    incomingSlots = new Map();
    notify('ready');
  };

  const checkIncomingComplete = (): void => {
    if (!incomingGroup) return;
    for (const key of desiredKeys) {
      if (!incomingSlots.has(key) && !failedKeys.has(key)) return;
    }
    if (incomingSlots.size > 0) {
      revealIncoming(performance.now());
      return;
    }
    disposeIncoming();
    notify('error');
  };

  function pump(): void {
    while (activeLoads < MAX_CONCURRENT_REQUESTS && queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const key = earthDetailTileKey(next);
      if (
        !incomingGroup ||
        incomingSlots.has(key) ||
        failedKeys.has(key) ||
        !desiredKeys.has(key)
      ) {
        continue;
      }
      startLoad(next);
    }
  }

  function startLoad(tile: EarthDetailTile): void {
    const key = earthDetailTileKey(tile);
    if (!incomingGroup || pending.has(key)) return;
    const generation = incomingGeneration;
    const controller = new AbortController();
    const url = earthDetailTileUrl(options.baseUrl, tile);
    activeLoads += 1;
    controllers.set(key, controller);

    const promise = fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
      credentials: 'same-origin',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Earth detail request failed with HTTP ${response.status}.`);
        }
        return response.blob();
      })
      .then(async (blob) => {
        throwIfAborted(controller.signal);
        if (!blob.size) throw new Error('Earth detail response was empty.');
        const objectUrl = URL.createObjectURL(blob);
        try {
          const texture = await textureLoader.loadAsync(objectUrl);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          texture.anisotropy = Math.min(
            8,
            options.renderer.capabilities.getMaxAnisotropy(),
          );
          if (
            disposed ||
            generation !== incomingGeneration ||
            !incomingGroup ||
            !desiredKeys.has(key)
          ) {
            texture.dispose();
            return;
          }
          const existing = textures.get(key);
          if (existing) {
            existing.lastUsed = Date.now();
            texture.dispose();
            addIncomingMesh(tile, existing.texture);
          } else {
            textures.set(key, { texture, lastUsed: Date.now() });
            addIncomingMesh(tile, texture);
          }
          trimTextureCache();
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch((error: unknown) => {
        if (!isAbortError(error) && generation === incomingGeneration) {
          failedKeys.add(key);
        }
      })
      .finally(() => {
        activeLoads -= 1;
        if (pending.get(key)?.controller === controller) pending.delete(key);
        if (controllers.get(key) === controller) controllers.delete(key);
        if (disposed) return;
        if (generation !== incomingGeneration) {
          pump();
          return;
        }
        checkIncomingComplete();
        pump();
      });

    pending.set(key, { promise, controller });
  }

  const requestTile = (tile: EarthDetailTile): void => {
    const key = earthDetailTileKey(tile);
    if (
      !incomingGroup ||
      incomingSlots.has(key) ||
      pending.has(key) ||
      failedKeys.has(key) ||
      !desiredKeys.has(key)
    ) {
      return;
    }
    const cached = textures.get(key);
    if (cached) {
      cached.lastUsed = Date.now();
      addIncomingMesh(tile, cached.texture);
      return;
    }
    if (activeLoads < MAX_CONCURRENT_REQUESTS) {
      startLoad(tile);
    } else if (!queue.some((queued) => earthDetailTileKey(queued) === key)) {
      queue.push(tile);
    }
  };

  const beginIncoming = (): void => {
    abortIncomingRequests();
    disposeIncoming();
    disposeRetiring();
    const group = new THREE.Group();
    group.name = 'earth-high-resolution-incoming';
    group.visible = false;
    root.add(group);
    incomingGroup = group;
    incomingSlots = new Map();
    failedKeys.clear();
  };

  const applySelection = (selection: EarthDetailSelection): void => {
    if (selection.level === null || selection.tiles.length === 0) {
      clear();
      return;
    }
    const nextKeys = new Set(selection.tiles.map(earthDetailTileKey));
    const nextSignature = [...nextKeys].sort().join('|');
    if (nextSignature === signature) return;
    signature = nextSignature;
    currentLevel = selection.level;
    atMaxLevel = selection.atMaxLevel;
    failedKeys.clear();
    desiredKeys.clear();
    for (const tile of selection.tiles) {
      const key = earthDetailTileKey(tile);
      desiredKeys.add(key);
    }

    const activeMatches =
      !incomingGroup &&
      activeGroup !== null &&
      sameKeys(desiredKeys, new Set(activeSlots.keys()));
    if (activeMatches) {
      notify('ready');
      return;
    }

    beginIncoming();
    notify('loading');
    for (const tile of selection.tiles) {
      requestTile(tile);
    }
    checkIncomingComplete();
    pump();
  };

  return {
    group: root,
    update({
      camera,
      earthGroup,
      target,
      viewportWidth,
      viewportHeight,
      pixelRatio,
      allowSelection,
    }): void {
      if (disposed) return;
      const now = performance.now();

      if (retiringGroup && now >= retiringAtMs) disposeRetiring();
      for (const slot of activeSlots.values()) {
        if (slot.fadeStartMs === null) continue;
        const progress = Math.min(1, (now - slot.fadeStartMs) / FADE_DURATION_MS);
        slot.material.uniforms.uFade!.value = easeInOut(progress);
        if (progress >= 1) slot.fadeStartMs = null;
      }

      const earthCenter = new THREE.Vector3();
      earthGroup.getWorldPosition(earthCenter);
      const cameraDistance = camera.position.distanceTo(earthCenter);
      const lookingAtEarth = target.distanceTo(earthCenter) < 0.25;
      if (
        !lookingAtEarth ||
        cameraDistance <= 1 ||
        cameraDistance >= EARTH_DETAIL_DEACTIVATION_DISTANCE
      ) {
        if (
          activeGroup ||
          incomingGroup ||
          retiringGroup ||
          desiredKeys.size > 0
        ) {
          clear();
        }
        return;
      }
      if (!allowSelection) return;

      earthGroup.updateWorldMatrix(true, false);
      const localCamera = earthGroup.worldToLocal(camera.position.clone()).normalize();
      const nadirLatitude = Math.asin(
        Math.min(1, Math.max(-1, localCamera.y)),
      ) * (180 / Math.PI);
      const nadirLongitude =
        Math.abs(localCamera.x) + Math.abs(localCamera.z) < 1e-12
          ? 0
          : Math.atan2(-localCamera.z, localCamera.x) * (180 / Math.PI);
      const cameraSignature = [
        cameraDistance.toFixed(4),
        nadirLatitude.toFixed(4),
        nadirLongitude.toFixed(4),
        camera.fov.toFixed(1),
        viewportWidth.toFixed(0),
        viewportHeight.toFixed(0),
        pixelRatio.toFixed(2),
      ].join('|');
      if (cameraSignature !== lastCameraSignature) {
        lastCameraSignature = cameraSignature;
        lastCameraChangeAt = now;
        return;
      }
      if (now - lastCameraChangeAt < CAMERA_SETTLE_MS) return;

      const hasDetail = activeGroup !== null || desiredKeys.size > 0;
      const selection = selectEarthDetailTiles(
        {
          latitudeDeg: nadirLatitude,
          longitudeDeg: nadirLongitude,
          cameraDistance,
          fovDeg: camera.fov,
          viewportWidth,
          viewportHeight,
          pixelRatio,
        },
        {
          maxTiles,
          maxCameraDistance: hasDetail
            ? EARTH_DETAIL_DEACTIVATION_DISTANCE
            : EARTH_DETAIL_ACTIVATION_DISTANCE,
        },
      );
      if (selection.level === null || selection.tiles.length === 0) {
        if (activeGroup || incomingGroup || desiredKeys.size > 0) clear();
        return;
      }
      applySelection(selection);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clear();
      root.removeFromParent();
    },
  };
}
