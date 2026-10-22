import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createStarfield } from '../shared/starfield';
import { disposeObjectTree, removeCanvas } from '../shared/dispose';
import { RenderLoop } from '../shared/renderLoop';
import {
  createSolarSystem,
  type SolarSystemVisual,
} from './solarSystem';

const OVERVIEW_POSITION = new THREE.Vector3(0, 2.15, 7.4);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);

export interface FreeExploreSceneOptions {
  container: HTMLElement;
  lowPower?: boolean;
  onSelectBody?: (bodyId: string) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

interface CameraTween {
  startSeconds: number;
  durationSeconds: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;
}

function materialPixelRatio(lowPower: boolean): number {
  const deviceRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(deviceRatio, lowPower ? 1.25 : 2);
}

export class FreeExploreScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly visual: SolarSystemVisual;
  private readonly loop: RenderLoop;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly options: FreeExploreSceneOptions;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly prefersReducedMotion: boolean;
  private lowPower: boolean;
  private tween: CameraTween | null = null;
  private elapsedSeconds = 0;
  private disposed = false;
  private pointerDown: { x: number; y: number; time: number } | null = null;

  private constructor(
    renderer: THREE.WebGLRenderer,
    visual: SolarSystemVisual,
    options: FreeExploreSceneOptions,
    prefersReducedMotion: boolean,
  ) {
    this.renderer = renderer;
    this.visual = visual;
    this.options = options;
    this.lowPower = options.lowPower ?? false;
    this.prefersReducedMotion = prefersReducedMotion;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050c);
    this.scene.add(visual.root);
    const stars = createStarfield(280);
    this.scene.add(stars.group);

    const width = Math.max(options.container.clientWidth, 1);
    const height = Math.max(options.container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.05, 1200);
    this.camera.position.copy(OVERVIEW_POSITION);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.copy(OVERVIEW_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.85;
    this.controls.minDistance = 1.15;
    this.controls.maxDistance = 110;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI - 0.05;
    this.controls.update();

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => this.resize());
    this.resizeObserver?.observe(options.container);

    this.loop = new RenderLoop((elapsed, delta) => this.renderFrame(elapsed, delta));
    this.loop.start();
  }

  static async create(options: FreeExploreSceneOptions): Promise<FreeExploreScene> {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch (error) {
      throw new Error(
        `WebGL renderer could not be created: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }

    const canvas = renderer.domElement;
    canvas.className = 'cosmos-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    options.container.appendChild(canvas);

    try {
      renderer.setPixelRatio(materialPixelRatio(options.lowPower ?? false));
      renderer.setSize(
        Math.max(options.container.clientWidth, 1),
        Math.max(options.container.clientHeight, 1),
        false,
      );
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      const visual = await createSolarSystem(renderer);
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return new FreeExploreScene(renderer, visual, options, prefersReducedMotion);
    } catch (error) {
      removeCanvas(canvas);
      renderer.dispose();
      renderer.forceContextLoss();
      throw new Error(
        `بارگذاری صحنهٔ سه‌بعدی ناموفق بود. ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }

  selectBody(bodyId: string | null): void {
    const ring = this.visual.selectionRing;
    if (!bodyId) {
      ring.visible = false;
      return;
    }
    const body = this.visual.bodies.get(bodyId);
    if (!body) {
      ring.visible = false;
      return;
    }
    ring.position.copy(body.position);
    ring.scale.setScalar(body.radius * 2.8);
    ring.visible = true;
  }

  focusBody(bodyId: string): void {
    const body = this.visual.bodies.get(bodyId);
    if (!body) return;

    if (bodyId === 'earth') {
      this.resetOverview();
      return;
    }

    const currentDirection = this.camera.position.clone().sub(this.controls.target);
    if (currentDirection.lengthSq() < 1e-8) {
      currentDirection.set(0, 0.35, 1);
    }
    currentDirection.normalize();

    // Approach the Moon and Mars mostly from their sunlit hemisphere. If we
    // keep the camera's previous direction, selecting them from the overview
    // often reveals only a thin backlit crescent.
    const sun = this.visual.bodies.get('sun');
    let direction = currentDirection;
    if ((bodyId === 'moon' || bodyId === 'mars') && sun) {
      const towardSun = sun.position.clone().sub(body.position).normalize();
      direction = towardSun.multiplyScalar(0.72).addScaledVector(currentDirection, 0.28);
      if (direction.lengthSq() < 1e-8) {
        direction = currentDirection;
      }
      direction.normalize();
    }

    const distance = Math.max(body.radius * 4.6, body.radius + 1.5);
    const toPosition = body.position.clone().addScaledVector(direction, distance);
    this.controls.minDistance = Math.max(0.32, body.radius * 1.35);
    this.startTween(toPosition, body.position);
  }

  resetOverview(): void {
    this.controls.minDistance = 1.15;
    this.startTween(OVERVIEW_POSITION.clone(), OVERVIEW_TARGET.clone());
  }

  setLowPower(enabled: boolean): void {
    this.lowPower = enabled;
    this.renderer.setPixelRatio(materialPixelRatio(enabled));
    this.resize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );
    this.controls.dispose();
    disposeObjectTree(this.scene);
    const canvas = this.renderer.domElement;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    removeCanvas(canvas);
  }

  private startTween(toPosition: THREE.Vector3, toTarget: THREE.Vector3): void {
    this.controls.enabled = false;
    this.tween = {
      startSeconds: this.elapsedSeconds,
      durationSeconds: this.prefersReducedMotion ? 0.2 : 0.9,
      fromPosition: this.camera.position.clone(),
      toPosition,
      fromTarget: this.controls.target.clone(),
      toTarget,
    };
  }

  private renderFrame(elapsed: number, delta: number): void {
    this.elapsedSeconds = elapsed;

    if (this.tween) {
      const rawProgress = Math.min(
        1,
        Math.max(0, (elapsed - this.tween.startSeconds) / this.tween.durationSeconds),
      );
      const progress = easeInOutCubic(rawProgress);
      this.camera.position.lerpVectors(
        this.tween.fromPosition,
        this.tween.toPosition,
        progress,
      );
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, progress);
      if (rawProgress >= 1) {
        this.tween = null;
        this.controls.enabled = true;
      }
    }

    this.controls.update();
    if (!this.prefersReducedMotion) {
      this.visual.update(elapsed, delta, this.lowPower);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    if (this.disposed) return;
    const width = Math.max(this.options.container.clientWidth, 1);
    const height = Math.max(this.options.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(materialPixelRatio(this.lowPower));
    this.renderer.setSize(width, height, false);
  }

  private updateRaycaster(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
    this.renderer.domElement.style.cursor = 'grabbing';
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerDown;
    this.pointerDown = null;
    this.renderer.domElement.style.cursor = 'grab';
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    const duration = performance.now() - start.time;
    if (moved > 8 || duration > 900 || this.tween) return;

    this.updateRaycaster(event);
    const hits = this.raycaster.intersectObjects(this.visual.interactiveMeshes, false);
    const bodyId = hits[0]?.object.userData.bodyId;
    if (typeof bodyId === 'string') {
      this.options.onSelectBody?.(bodyId);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || this.pointerDown) return;
    this.updateRaycaster(event);
    const hits = this.raycaster.intersectObjects(this.visual.interactiveMeshes, false);
    this.renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
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
