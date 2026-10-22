import * as THREE from 'three';
import { geodeticToUnitVector, unitVectorToGeodetic } from '../../geo/earthCoordinates';
import {
  selectGlobeTiles,
  tileBounds,
  tileKey,
  type TileCoordinate,
} from '../../geo/tiles/tileMath';
import {
  OSM_RASTER_TILES,
  tileUrl,
  type RasterTileProvider,
} from '../../geo/tiles/tileProvider';

const TILE_RADIUS = 1.000035;
const RETRY_AFTER_MS = 30_000;
const MAX_TEXTURE_CACHE = 18;
const TILE_CACHE_NAME = 'cosmos-explorer-osm-tiles-v1';
const MAX_PERSISTED_TILES = 120;
const LOD_SETTLE_MS = 260;

export type MapDetailPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface MapDetailStatus {
  phase: MapDetailPhase;
  zoom: number | null;
  loadedTiles: number;
  failedTiles: number;
}

export interface GlobeTileLayerOptions {
  renderer: THREE.WebGLRenderer;
  provider?: RasterTileProvider;
  onStatus?: (status: MapDetailStatus) => void;
}

export interface GlobeTileLayer {
  group: THREE.Group;
  update(input: {
    camera: THREE.PerspectiveCamera;
    earthGroup: THREE.Object3D;
    target: THREE.Vector3;
    viewportWidth: number;
    viewportHeight: number;
    deltaSeconds: number;
  }): void;
  dispose(): void;
}

interface TileSlot {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  opacity: number;
  finalized: boolean;
}

interface CachedTexture {
  texture: THREE.Texture;
  lastUsed: number;
}

function createTileGeometry(tile: TileCoordinate): THREE.BufferGeometry {
  const bounds = tileBounds(tile);
  const segments = tile.zoom <= 5 ? 8 : tile.zoom <= 10 ? 4 : 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segments; iy += 1) {
    const v = iy / segments;
    const latitude = bounds.northLat + (bounds.southLat - bounds.northLat) * v;
    for (let ix = 0; ix <= segments; ix += 1) {
      const u = ix / segments;
      const longitude = bounds.westLon + (bounds.eastLon - bounds.westLon) * u;
      const direction = geodeticToUnitVector(latitude, longitude);
      positions.push(
        direction.x * TILE_RADIUS,
        direction.y * TILE_RADIUS,
        direction.z * TILE_RADIUS,
      );
      uvs.push(u, 1 - v);
    }
  }

  for (let iy = 0; iy < segments; iy += 1) {
    for (let ix = 0; ix < segments; ix += 1) {
      const row = segments + 1;
      const a = iy * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

async function trimPersistentCache(cache: Cache): Promise<void> {
  try {
    const requests = await cache.keys();
    if (requests.length <= MAX_PERSISTED_TILES) return;
    const excess = requests.length - MAX_PERSISTED_TILES;
    for (let index = 0; index < excess; index += 1) {
      const request = requests[index];
      if (request) await cache.delete(request);
    }
  } catch {
    // Cache trimming is best-effort; the browser owns the final quota policy.
  }
}

/**
 * Loads a tile through the browser's persistent Cache Storage when available.
 * OSM requires at least seven days of local caching when response caching
 * headers cannot be used; the cache entry carries its own timestamp.
 */
async function loadTileBlob(
  url: string,
  provider: RasterTileProvider,
): Promise<Blob> {
  const canUseCache =
    typeof caches !== 'undefined' && typeof window !== 'undefined' && window.isSecureContext;
  let cache: Cache | null = null;
  if (canUseCache) {
    try {
      cache = await caches.open(TILE_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        const cachedAt = Number(cached.headers.get('x-cached-at'));
        const fresh =
          Number.isFinite(cachedAt) &&
          Date.now() - cachedAt <= provider.cacheMaxAgeMs;
        if (fresh) {
          return await cached.blob();
        }
        await cache.delete(url);
      }
    } catch {
      cache = null;
    }
  }

  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new Error(`Tile request failed with HTTP ${response.status}.`);
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error('Tile response was empty.');
  }

  if (cache) {
    try {
      const headers = new Headers();
      headers.set('content-type', response.headers.get('content-type') ?? 'image/png');
      headers.set('x-cached-at', String(Date.now()));
      await cache.put(url, new Response(blob, { headers }));
      void trimPersistentCache(cache);
    } catch {
      // A failed cache write must not break map rendering.
    }
  }
  return blob;
}

export function createGlobeTileLayer(
  options: GlobeTileLayerOptions,
): GlobeTileLayer {
  const provider = options.provider ?? OSM_RASTER_TILES;
  const group = new THREE.Group();
  group.name = 'earth-osm-detail';

  const textureLoader = new THREE.TextureLoader();
  const meshes = new Map<string, TileSlot>();
  const textures = new Map<string, CachedTexture>();
  const pending = new Map<string, Promise<THREE.Texture | null>>();
  const failedAt = new Map<string, number>();
  const desiredKeys = new Set<string>();
  const desiredTiles = new Map<string, TileCoordinate>();
  const queue: TileCoordinate[] = [];
  let activeLoads = 0;
  let signature = '';
  let currentZoom: number | null = null;
  let lastCameraSignature = '';
  let lastCameraChangeAt = 0;
  let disposed = false;
  let lastStatus = '';

  const notify = (phase: MapDetailPhase): void => {
    if (disposed || !options.onStatus) return;
    let loadedTiles = 0;
    let failedTiles = 0;
    for (const key of desiredKeys) {
      if (meshes.has(key)) loadedTiles += 1;
      else if (failedAt.has(key)) failedTiles += 1;
    }
    const status: MapDetailStatus = {
      phase,
      zoom: currentZoom,
      loadedTiles,
      failedTiles,
    };
    const statusKey = `${phase}:${status.zoom}:${loadedTiles}:${failedTiles}`;
    if (statusKey === lastStatus) return;
    lastStatus = statusKey;
    options.onStatus(status);
  };

  const disposeSlot = (key: string): void => {
    const slot = meshes.get(key);
    if (!slot) return;
    group.remove(slot.mesh);
    slot.mesh.geometry.dispose();
    slot.material.dispose();
    meshes.delete(key);
  };

  const disposeAllTextures = (): void => {
    for (const cached of textures.values()) {
      cached.texture.dispose();
    }
    textures.clear();
  };

  const clear = (): void => {
    for (const key of [...meshes.keys()]) disposeSlot(key);
    disposeAllTextures();
    desiredKeys.clear();
    desiredTiles.clear();
    queue.length = 0;
    failedAt.clear();
    currentZoom = null;
    signature = '';
    lastCameraSignature = '';
    lastCameraChangeAt = 0;
    notify('idle');
  };

  const addMesh = (tile: TileCoordinate, texture: THREE.Texture): void => {
    const key = tileKey(tile);
    if (meshes.has(key) || !desiredKeys.has(key)) return;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(createTileGeometry(tile), material);
    mesh.renderOrder = 5;
    mesh.userData.tileKey = key;
    group.add(mesh);
    meshes.set(key, {
      mesh,
      material,
      opacity: 0,
      finalized: false,
    });
  };

  const trimTextureCache = (): void => {
    if (textures.size <= MAX_TEXTURE_CACHE) return;
    const unused = [...textures.entries()]
      .filter(([key]) => !desiredKeys.has(key))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key] of unused) {
      if (textures.size <= MAX_TEXTURE_CACHE) break;
      const cached = textures.get(key);
      if (!cached) continue;
      cached.texture.dispose();
      textures.delete(key);
    }
  };

  const requestTile = (tile: TileCoordinate): void => {
    const key = tileKey(tile);
    if (
      pending.has(key) ||
      meshes.has(key) ||
      !desiredKeys.has(key) ||
      failedAt.has(key)
    ) {
      return;
    }
    const cached = textures.get(key);
    if (cached) {
      cached.lastUsed = Date.now();
      addMesh(tile, cached.texture);
      return;
    }
    if (activeLoads < provider.maxConcurrentRequests) {
      startLoad(tile);
    } else if (!queue.some((queued) => tileKey(queued) === key)) {
      queue.push(tile);
    }
  };

  const startLoad = (tile: TileCoordinate): void => {
    const key = tileKey(tile);
    if (pending.has(key)) return;
    activeLoads += 1;
    const url = tileUrl(provider, tile);
    const promise = loadTileBlob(url, provider)
      .then(async (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        try {
          const texture = await textureLoader.loadAsync(objectUrl);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = Math.min(
            4,
            options.renderer.capabilities.getMaxAnisotropy(),
          );
          if (disposed) {
            texture.dispose();
            return null;
          }
          if (!desiredKeys.has(key)) {
            texture.dispose();
            return null;
          }
          textures.set(key, { texture, lastUsed: Date.now() });
          addMesh(tile, texture);
          trimTextureCache();
          return texture;
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {
        if (desiredKeys.has(key)) {
          failedAt.set(key, Date.now() + RETRY_AFTER_MS);
        }
        return null;
      })
      .finally(() => {
        pending.delete(key);
        activeLoads -= 1;
        pump();
        if (!disposed) {
          if (desiredKeys.size === 0) {
            notify('idle');
            return;
          }
          const missing = [...desiredKeys].filter(
            (desiredKey) => !meshes.has(desiredKey) && !failedAt.has(desiredKey),
          );
          if (missing.length === 0) {
            const failures = [...desiredKeys].filter((desiredKey) =>
              failedAt.has(desiredKey),
            ).length;
            notify(failures > 0 ? 'error' : 'ready');
          }
        }
      });
    pending.set(key, promise);
  };

  const pump = (): void => {
    while (activeLoads < provider.maxConcurrentRequests && queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const key = tileKey(next);
      if (!desiredKeys.has(key) || failedAt.has(key) || meshes.has(key)) continue;
      startLoad(next);
    }
  };

  const applySelection = (
    selectedTiles: TileCoordinate[],
    zoom: number,
  ): void => {
    const nextSignature = [...selectedTiles.map(tileKey)].sort().join('|');
    if (nextSignature === signature) {
      // Retry failed tiles after their cooldown without new prefetching.
      for (const [key, retryAt] of failedAt) {
        if (desiredKeys.has(key) && Date.now() >= retryAt) {
          failedAt.delete(key);
          const tile = desiredTiles.get(key);
          if (tile) requestTile(tile);
        }
      }
      return;
    }
    signature = nextSignature;
    currentZoom = zoom;
    desiredKeys.clear();
    desiredTiles.clear();
    for (const tile of selectedTiles) {
      desiredKeys.add(tileKey(tile));
      desiredTiles.set(tileKey(tile), tile);
    }

    for (const key of [...meshes.keys()]) {
      if (!desiredKeys.has(key)) disposeSlot(key);
    }
    for (const key of [...failedAt.keys()]) {
      if (!desiredKeys.has(key)) failedAt.delete(key);
    }

    let hasMissing = false;
    for (const tile of selectedTiles) {
      const key = tileKey(tile);
      if (meshes.has(key)) continue;
      const cached = textures.get(key);
      if (cached) {
        cached.lastUsed = Date.now();
        addMesh(tile, cached.texture);
      } else {
        hasMissing = true;
        requestTile(tile);
      }
    }
    trimTextureCache();
    notify(hasMissing ? 'loading' : 'ready');
  };

  return {
    group,
    update({ camera, earthGroup, target, viewportWidth, viewportHeight, deltaSeconds }) {
      if (disposed) return;

      for (const slot of meshes.values()) {
        if (slot.opacity < 1) {
          slot.opacity = Math.min(1, slot.opacity + deltaSeconds * 4);
          slot.material.opacity = slot.opacity;
          if (slot.opacity >= 1 && !slot.finalized) {
            slot.finalized = true;
            slot.material.transparent = false;
            slot.material.needsUpdate = true;
          }
        }
      }

      const now = performance.now();

      const earthCenter = new THREE.Vector3();
      earthGroup.getWorldPosition(earthCenter);
      const cameraDistance = camera.position.distanceTo(earthCenter);
      const lookingAtEarth = target.distanceTo(earthCenter) < 0.25;
      if (!lookingAtEarth || cameraDistance >= 3.2 || cameraDistance <= 1) {
        if (signature !== '') clear();
        return;
      }

      earthGroup.updateWorldMatrix(true, false);
      const localCamera = earthGroup.worldToLocal(camera.position.clone()).normalize();
      const nadir = unitVectorToGeodetic(localCamera);
      const cameraSignature = [
        cameraDistance.toFixed(4),
        nadir.latitudeDeg.toFixed(4),
        nadir.longitudeDeg.toFixed(4),
        camera.fov.toFixed(1),
        viewportWidth.toFixed(0),
        viewportHeight.toFixed(0),
      ].join('|');
      if (cameraSignature !== lastCameraSignature) {
        lastCameraSignature = cameraSignature;
        lastCameraChangeAt = now;
        // Wait for the camera to settle before requesting a new tile set.
        // This prevents firing a request wave for every intermediate zoom
        // level while a fly-to animation or a pinch gesture is in progress.
        return;
      }
      if (now - lastCameraChangeAt < LOD_SETTLE_MS) return;

      const selection = selectGlobeTiles({
        latitudeDeg: nadir.latitudeDeg,
        longitudeDeg: nadir.longitudeDeg,
        cameraDistance,
        fovDeg: camera.fov,
        viewportWidth,
        viewportHeight,
        maxZoom: provider.maxZoom,
        maxTiles: 9,
      });
      if (selection.zoom === null || selection.tiles.length === 0) {
        if (signature !== '') clear();
        return;
      }
      applySelection(selection.tiles, selection.zoom);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clear();
      group.removeFromParent();
      for (const promise of pending.values()) {
        promise.finally(() => undefined);
      }
      pending.clear();
    },
  };
}
