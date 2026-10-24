import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { SkySnapshot } from '../../astronomy/types';
import {
  headingDegreesFromQuaternion,
  manualLookQuaternion,
  pitchDegreesFromQuaternion,
  type QuaternionTuple,
} from '../../sensors/orientationMath';
import { RenderLoop } from '../shared/renderLoop';
import { disposeObjectTree, removeCanvas } from '../shared/dispose';
import { createSkyDome, type SkyDome } from './skyDome';
import { createSkyGrid, type SkyGrid } from './skyGrid';
import { createSkyObjects, type SkyObjectsLayer } from './skyObjects';

export interface SkySceneOptions {
  container: HTMLElement;
  lowPower?: boolean;
  active?: boolean;
  showGrid?: boolean;
  initialFov?: number;
  onSelectBody?: (bodyId: string) => void;
  onFovChange?: (fovDeg: number) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

const MIN_FOV = 25;
const MAX_FOV = 100;
const MIN_PITCH = -85;
const MAX_PITCH = 85;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toTuple(quaternion: THREE.Quaternion): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

export class SkyScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly dome: SkyDome;
  private readonly grid: SkyGrid;
  private readonly objects: SkyObjectsLayer;
  private readonly loop: RenderLoop;
  private readonly options: SkySceneOptions;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private snapshot: SkySnapshot | null = null;
  private attitudeTarget: THREE.Quaternion | null = null;
  private attitudeActive = false;
  private hasAttitude = false;
  private manualHeadingDeg = 180;
  private manualPitchDeg = 18;
  private fovDeg: number;
  private cameraOverlayActive = false;
  private showGrid: boolean;
  private lowPower: boolean;
  private active: boolean;
  private pinch: { startDistance: number; startFov: number } | null = null;
  private tap: { x: number; y: number; moved: number } | null = null;
  private disposed = false;

  private constructor(
    renderer: THREE.WebGLRenderer,
    labelRenderer: CSS2DRenderer,
    options: SkySceneOptions,
  ) {
    this.renderer = renderer;
    this.labelRenderer = labelRenderer;
    this.options = options;
    this.lowPower = options.lowPower ?? false;
    this.active = options.active ?? true;
    this.showGrid = options.showGrid ?? true;
    this.fovDeg = clamp(options.initialFov ?? 65, MIN_FOV, MAX_FOV);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      this.fovDeg,
      Math.max(options.container.clientWidth, 1) / Math.max(options.container.clientHeight, 1),
      0.1,
      700,
    );
    this.camera.position.set(0, 0, 0);

    this.dome = createSkyDome();
    this.scene.add(this.dome.mesh);
    this.grid = createSkyGrid();
    this.grid.setVisible(this.showGrid);
    this.scene.add(this.grid.group);
    this.objects = createSkyObjects();
    this.scene.add(this.objects.root);

    const canvas = renderer.domElement;
    canvas.className = 'cosmos-canvas sky-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    options.container.appendChild(canvas);

    this.labelRenderer.domElement.className = 'sky-label-layer';
    this.labelRenderer.domElement.setAttribute('aria-hidden', 'true');
    options.container.appendChild(this.labelRenderer.domElement);

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => this.resize());
    this.resizeObserver?.observe(options.container);

    this.loop = new RenderLoop(() => this.renderFrame());
    this.loop.start();
    this.resize();
    this.setActive(this.active);
  }

  static create(options: SkySceneOptions): SkyScene {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      throw new Error(
        `WebGL renderer could not be created: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(this.pixelRatio(options.lowPower ?? false));
    renderer.setSize(
      Math.max(options.container.clientWidth, 1),
      Math.max(options.container.clientHeight, 1),
      false,
    );

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(
      Math.max(options.container.clientWidth, 1),
      Math.max(options.container.clientHeight, 1),
    );

    try {
      return new SkyScene(renderer, labelRenderer, options);
    } catch (error) {
      removeCanvas(renderer.domElement);
      labelRenderer.domElement.remove();
      renderer.dispose();
      renderer.forceContextLoss();
      throw error;
    }
  }

  private static pixelRatio(lowPower: boolean): number {
    const deviceRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return Math.min(deviceRatio, lowPower ? 1.25 : 2);
  }

  updateSnapshot(snapshot: SkySnapshot): void {
    this.snapshot = snapshot;
    this.dome.setSunAltitude(snapshot.sunAltitudeDeg);
    const dayFactor = clamp((snapshot.sunAltitudeDeg + 8) / 20, 0, 1);
    this.grid.setDaylight(dayFactor);
    this.labelRenderer.domElement.classList.toggle('is-day', dayFactor > 0.45);
    this.objects.update(snapshot, this.cameraOverlayActive);
  }

  setAttitude(quaternion: QuaternionTuple | null): void {
    if (quaternion === null) {
      if (this.attitudeActive) {
        const current = toTuple(this.camera.quaternion);
        this.manualHeadingDeg = headingDegreesFromQuaternion(current);
        this.manualPitchDeg = clamp(
          pitchDegreesFromQuaternion(current),
          MIN_PITCH,
          MAX_PITCH,
        );
      }
      this.attitudeActive = false;
      this.attitudeTarget = null;
      return;
    }
    if (
      quaternion.some((value) => !Number.isFinite(value)) ||
      Math.hypot(...quaternion) < 1e-6
    ) {
      return;
    }
    this.attitudeActive = true;
    this.attitudeTarget = new THREE.Quaternion(
      quaternion[0],
      quaternion[1],
      quaternion[2],
      quaternion[3],
    ).normalize();
    if (!this.hasAttitude) {
      this.camera.quaternion.copy(this.attitudeTarget);
      this.hasAttitude = true;
    }
  }

  isAttitudeActive(): boolean {
    return this.attitudeActive;
  }

  setFov(fovDeg: number, notify = false): void {
    if (!Number.isFinite(fovDeg)) return;
    const next = clamp(fovDeg, MIN_FOV, MAX_FOV);
    if (Math.abs(next - this.fovDeg) < 0.01) return;
    this.fovDeg = next;
    this.camera.fov = next;
    this.camera.updateProjectionMatrix();
    if (notify) {
      this.options.onFovChange?.(next);
    }
  }

  getFov(): number {
    return this.fovDeg;
  }

  /**
   * Turns the free-look camera toward an object. Has no effect while the
   * physical orientation sensor is in control.
   */
  lookAtHorizontal(horizontal: { altitudeDeg: number; azimuthDeg: number }): void {
    if (this.attitudeActive) return;
    if (!Number.isFinite(horizontal.altitudeDeg) || !Number.isFinite(horizontal.azimuthDeg)) {
      return;
    }
    this.manualHeadingDeg = ((horizontal.azimuthDeg % 360) + 360) % 360;
    this.manualPitchDeg = clamp(horizontal.altitudeDeg, MIN_PITCH, MAX_PITCH);
  }

  setShowGrid(visible: boolean): void {
    this.showGrid = visible;
    this.grid.setVisible(visible);
  }

  setCameraOverlayActive(active: boolean): void {
    if (this.cameraOverlayActive === active) return;
    this.cameraOverlayActive = active;
    this.dome.mesh.visible = !active;
    if (this.snapshot) {
      this.objects.update(this.snapshot, active);
    }
  }

  setSelectedBody(bodyId: string | null): void {
    this.objects.setSelected(bodyId);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.loop.setPaused(!active);
    if (active) {
      this.resize();
    }
  }

  setLowPower(enabled: boolean): void {
    this.lowPower = enabled;
    this.renderer.setPixelRatio(SkyScene.pixelRatio(enabled));
    this.resize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.resizeObserver?.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    disposeObjectTree(this.scene);
    this.labelRenderer.domElement.remove();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    removeCanvas(canvas);
  }

  private resize(): void {
    if (this.disposed || !this.active) return;
    const width = Math.max(this.options.container.clientWidth, 1);
    const height = Math.max(this.options.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(SkyScene.pixelRatio(this.lowPower));
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
  }

  private renderFrame(): void {
    this.camera.position.set(0, 0, 0);
    if (this.attitudeActive && this.attitudeTarget) {
      this.camera.quaternion.slerp(this.attitudeTarget, 0.3);
    } else {
      const quaternion = manualLookQuaternion(this.manualHeadingDeg, this.manualPitchDeg);
      this.camera.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
    }
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  private updateRaycaster(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private selectAt(clientX: number, clientY: number): void {
    this.updateRaycaster(clientX, clientY);
    const hits = this.raycaster.intersectObjects(this.objects.getHitAreas(), false);
    const bodyId = hits[0]?.object.userData.bodyId;
    if (typeof bodyId === 'string') {
      this.options.onSelectBody?.(bodyId);
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.disposed) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
    if (this.pointers.size === 1) {
      this.tap = { x: event.clientX, y: event.clientY, moved: 0 };
    }
    if (this.pointers.size === 2 && !this.attitudeActive) {
      const [first, second] = [...this.pointers.values()];
      if (first && second) {
        this.pinch = {
          startDistance: Math.hypot(first.x - second.x, first.y - second.y),
          startFov: this.fovDeg,
        };
      }
      this.tap = null;
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.disposed) return;
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.tap) {
      this.tap.moved += Math.hypot(dx, dy);
      if (this.tap.moved > 8) {
        // A deliberate drag, not a tap.
      }
    }

    if (this.pointers.size === 2) {
      const [first, second] = [...this.pointers.values()];
      if (first && second && this.pinch && !this.attitudeActive) {
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (distance > 1) {
          this.setFov(this.pinch.startFov * (this.pinch.startDistance / distance), true);
        }
      }
      return;
    }

    if (this.attitudeActive || this.pointers.size !== 1) return;
    const scale = 0.055 * (this.fovDeg / 65);
    this.manualHeadingDeg = (this.manualHeadingDeg - dx * scale + 360) % 360;
    this.manualPitchDeg = clamp(this.manualPitchDeg + dy * scale, MIN_PITCH, MAX_PITCH);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.disposed) return;
    const tap = this.tap;
    this.pointers.delete(event.pointerId);
    this.renderer.domElement.releasePointerCapture?.(event.pointerId);
    if (this.pointers.size < 2) {
      this.pinch = null;
    }
    if (this.tap && tap && tap.moved <= 8 && this.pointers.size === 0) {
      this.selectAt(event.clientX, event.clientY);
    }
    if (this.pointers.size === 0) {
      this.tap = null;
    }
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.pinch = null;
    if (this.pointers.size === 0) {
      this.tap = null;
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (this.disposed) return;
    event.preventDefault();
    this.setFov(this.fovDeg + event.deltaY * 0.02, true);
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.loop.setPaused(true);
    this.options.onContextLost?.();
  };

  private readonly handleContextRestored = (): void => {
    this.loop.setPaused(false);
    this.options.onContextRestored?.();
  };
}
