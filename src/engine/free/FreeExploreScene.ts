import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { computeReferenceFrame } from '../../astronomy/referenceFrame';
import { getBodyById } from '../../catalog/bodies';
import {
  appSimulationClock,
  SimulationClock,
} from '../../astronomy/simulationClock';
import { geodeticToUnitVector } from '../../geo/earthCoordinates';
import { computeEarthNavigationSensitivity } from '../../geo/earthNavigation';
import type { GeoLocation } from '../../geo/types';
import { createStarfield } from '../shared/starfield';
import { disposeObjectTree, removeCanvas } from '../shared/dispose';
import { RenderLoop } from '../shared/renderLoop';
import {
  FreeFlightController,
  cameraForward,
  computeProximityMotionScale,
  quaternionLookingAt,
  type RotationAxis,
  type TranslationAxis,
} from './freeFlight';
import {
  createSolarSystem,
  type SolarSystemVisual,
} from './solarSystem';
import {
  createEarthLocationLayer,
  type EarthLocationLayer,
} from './earthLocationLayer';
import {
  createGlobeTileLayer,
  type GlobeTileLayer,
  type MapDetailStatus,
} from './globeTiles';
import {
  createEarthDetailLayer,
  type EarthDetailLayer,
  type EarthDetailStatus,
} from './earthDetailLayer';

const OVERVIEW_POSITION = new THREE.Vector3(0, 2.15, 7.4);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const OVERVIEW_QUATERNION = quaternionLookingAt(OVERVIEW_POSITION, OVERVIEW_TARGET);
const GEO_FOCUS_DISTANCE = 1.08;
const KEY_DOLLY_PIXELS = 360;
const DRAG_PAN_SCALE = 0.01;
const TOUCH_PAN_SCALE = 0.008;

const KEYBOARD_BODY_IDS: Record<string, string> = {
  Digit1: 'earth',
  Digit2: 'moon',
  Digit3: 'sun',
  Digit4: 'mars',
};

const KEYBOARD_TRANSLATION: Record<string, TranslationAxis> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  KeyQ: 'up',
  KeyE: 'down',
};

const KEYBOARD_ROTATION: Record<string, RotationAxis> = {
  ArrowLeft: 'lookLeft',
  ArrowRight: 'lookRight',
  ArrowUp: 'lookUp',
  ArrowDown: 'lookDown',
  KeyZ: 'rollLeft',
  KeyC: 'rollRight',
};

export interface FreeExploreSceneOptions {
  container: HTMLElement;
  lowPower?: boolean;
  active?: boolean;
  mapOverlayEnabled?: boolean;
  clock?: SimulationClock;
  onSelectBody?: (bodyId: string) => void;
  onMapStatus?: (status: MapDetailStatus) => void;
  onEarthDetailStatus?: (status: EarthDetailStatus) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

interface FreeExploreLightingSnapshot {
  earthLocalSunDirection: number[];
  osmLocalSunDirection: number[];
  moonSceneSunDirection: number[];
  marsSceneSunDirection: number[];
  moonPosition: number[];
  marsPosition: number[];
  cameraPosition: number[];
  cameraQuaternion: number[];
}

interface GeoFocusTween {
  startSeconds: number;
  durationSeconds: number;
  fromDirection: THREE.Vector3;
  toDirection: THREE.Vector3;
  fromDistance: number;
  toDistance: number;
  rotation: THREE.Quaternion;
  fromQuaternion: THREE.Quaternion;
  toQuaternion: THREE.Quaternion;
}

interface CameraPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface CameraTween {
  startSeconds: number;
  durationSeconds: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromQuaternion: THREE.Quaternion;
  toQuaternion: THREE.Quaternion;
}

interface FlightSnapshot {
  position: number[];
  quaternion: number[];
  forward: number[];
  velocity: number[];
  viewTarget: number[];
  selectedBodyId: string | null;
  focusedBodyId: string | null;
  active: boolean;
}

interface ActivePointer {
  x: number;
  y: number;
}

interface MultiTouchState {
  centerX: number;
  centerY: number;
  distance: number;
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;
}

function materialPixelRatio(lowPower: boolean): number {
  const deviceRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(deviceRatio, lowPower ? 1.25 : 2);
}

const LABEL_BODY_IDS = ['earth', 'moon', 'sun', 'mars'] as const;

function createBodyLabel(bodyId: string): CSS2DObject {
  const element = document.createElement('span');
  element.className = 'free-body-label';
  element.dataset.body = bodyId;
  element.textContent = getBodyById(bodyId)?.nameFa ?? bodyId;
  const label = new CSS2DObject(element);
  label.center.set(0.5, 0.5);
  label.visible = false;
  return label;
}

export class FreeExploreScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly flight: FreeFlightController;
  private readonly visual: SolarSystemVisual;
  private readonly starfield: THREE.Group;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly labelScene = new THREE.Scene();
  private readonly bodyLabels = new Map<string, CSS2DObject>();
  private readonly earthDetail: EarthDetailLayer;
  private readonly globeTiles: GlobeTileLayer;
  private readonly locationLayer: EarthLocationLayer;
  private readonly loop: RenderLoop;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly labelProjection = new THREE.Vector3();
  private readonly viewTarget = new THREE.Vector3();
  private readonly activePointers = new Map<number, ActivePointer>();
  private readonly options: FreeExploreSceneOptions;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly prefersReducedMotion: boolean;
  private readonly clock: SimulationClock;
  private lowPower: boolean;
  private active: boolean;
  private tween: CameraTween | null = null;
  private geoFocusTween: GeoFocusTween | null = null;
  private selectedBodyId: string | null = null;
  private focusedBodyId: string | null = null;
  private readonly savedViews = new Map<string, CameraPose>();
  private multiTouch: MultiTouchState | null = null;
  private viewportWidth: number;
  private viewportHeight: number;
  private elapsedSeconds = 0;
  private lastAstronomyUpdateMs = 0;
  private disposed = false;
  private pointerDown: {
    id: number;
    button: number;
    pointerType: string;
    mode: 'look' | 'pan' | 'roll';
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    time: number;
    moved: number;
  } | null = null;
  private readonly lightingProbe = (): FreeExploreLightingSnapshot =>
    this.readLightingSnapshot();
  private readonly flightProbe = (): FlightSnapshot => this.readFlightSnapshot();

  private constructor(
    renderer: THREE.WebGLRenderer,
    visual: SolarSystemVisual,
    options: FreeExploreSceneOptions,
    prefersReducedMotion: boolean,
  ) {
    this.renderer = renderer;
    this.visual = visual;
    this.options = options;
    this.clock = options.clock ?? appSimulationClock;
    this.lowPower = options.lowPower ?? false;
    this.active = options.active ?? true;
    this.prefersReducedMotion = prefersReducedMotion;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050c);
    this.scene.add(visual.root);
    const stars = createStarfield(280);
    this.starfield = stars.group;
    this.scene.add(this.starfield);

    this.locationLayer = createEarthLocationLayer();
    visual.earthSpinGroup.add(this.locationLayer.group);
    this.earthDetail = createEarthDetailLayer({
      renderer,
      baseDayTexture: visual.earthDayTexture,
      baseNightTexture: visual.earthNightTexture,
      sunDirection: visual.earthSunDirection,
      baseUrl: import.meta.env.BASE_URL,
      onStatus: options.onEarthDetailStatus,
    });
    visual.earthSpinGroup.add(this.earthDetail.group);
    this.globeTiles = createGlobeTileLayer({
      renderer,
      sunDirection: visual.earthSunDirection,
      enabled: options.mapOverlayEnabled ?? true,
      onStatus: options.onMapStatus,
    });
    visual.earthSpinGroup.add(this.globeTiles.group);

    const width = Math.max(options.container.clientWidth, 1);
    const height = Math.max(options.container.clientHeight, 1);
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.05, 1200);
    this.camera.position.copy(OVERVIEW_POSITION);
    this.camera.quaternion.copy(OVERVIEW_QUATERNION);
    this.flight = new FreeFlightController(this.camera);
    this.flight.setEnabled(this.active);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'free-label-layer';
    this.labelRenderer.domElement.setAttribute('aria-hidden', 'true');
    this.labelRenderer.setSize(width, height);
    options.container.appendChild(this.labelRenderer.domElement);
    for (const bodyId of LABEL_BODY_IDS) {
      const label = createBodyLabel(bodyId);
      this.labelScene.add(label);
      this.bodyLabels.set(bodyId, label);
    }

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    renderer.domElement.addEventListener('pointercancel', this.handlePointerCancel);
    renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);
    renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
    document.addEventListener('keydown', this.handleNavigateKeyDown);
    document.addEventListener('keyup', this.handleNavigateKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);

    this.resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => this.resize());
    this.resizeObserver?.observe(options.container);
    this.updateAstronomy(true);
    this.updateViewTarget();

    this.loop = new RenderLoop((elapsed, delta) => this.renderFrame(elapsed, delta));
    this.loop.start();
    this.setActive(this.active);
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
    this.selectedBodyId = bodyId;
    this.updateSelectionRing();
  }

  private updateSelectionRing(): void {
    const ring = this.visual.selectionRing;
    if (!this.selectedBodyId) {
      ring.visible = false;
      return;
    }
    const body = this.visual.bodies.get(this.selectedBodyId);
    if (!body) {
      ring.visible = false;
      return;
    }
    ring.position.copy(body.position);
    ring.scale.setScalar(body.radius * 2.8);
    ring.visible = true;
  }

  private updateBodyLabels(): void {
    for (const [bodyId, label] of this.bodyLabels) {
      const body = this.visual.bodies.get(bodyId);
      if (!body) {
        label.visible = false;
        continue;
      }
      label.position.copy(body.position);
      label.position.y += body.radius * 1.55;
      this.labelProjection.copy(label.position).project(this.camera);
      const inFront =
        this.labelProjection.z > -1 && this.labelProjection.z < 1;
      const insideMargin =
        Math.abs(this.labelProjection.x) < 0.92 &&
        Math.abs(this.labelProjection.y) < 0.92;
      label.visible =
        inFront &&
        insideMargin &&
        this.camera.position.distanceTo(body.position) > body.radius * 1.4;
    }
  }

  setGeographicLocation(location: GeoLocation | null): void {
    this.locationLayer.setLocation(location);
  }

  setMapOverlayEnabled(enabled: boolean): void {
    this.globeTiles.setEnabled(enabled);
  }

  clearGeographicLocation(): void {
    this.locationLayer.setLocation(null);
  }

  /**
   * Moves the camera above a geographic coordinate. The camera remains a free
   * 6DOF body after the transition; the look target used for LOD is derived
   * from the camera's own quaternion.
   */
  focusGeographicLocation(location: GeoLocation): void {
    this.rememberCurrentView();
    this.flight.clearInputs();
    this.focusedBodyId = 'earth';
    this.locationLayer.setLocation(location);
    const local = geodeticToUnitVector(location.latitudeDeg, location.longitudeDeg);
    this.visual.earthSpinGroup.updateWorldMatrix(true, false);
    const worldQuaternion = new THREE.Quaternion();
    this.visual.earthSpinGroup.getWorldQuaternion(worldQuaternion);
    const direction = new THREE.Vector3(local.x, local.y, local.z)
      .applyQuaternion(worldQuaternion)
      .normalize();
    const toPosition = direction.clone().multiplyScalar(GEO_FOCUS_DISTANCE);
    const toQuaternion = quaternionLookingAt(toPosition, OVERVIEW_TARGET);
    this.savedViews.set('earth', {
      position: toPosition.clone(),
      quaternion: toQuaternion.clone(),
    });
    this.startGeoFocus(direction, GEO_FOCUS_DISTANCE, toQuaternion);
  }

  focusBody(bodyId: string): void {
    const body = this.visual.bodies.get(bodyId);
    if (!body) return;

    const previousBodyId = this.focusedBodyId;
    if (previousBodyId && previousBodyId !== bodyId) {
      this.rememberCurrentView();
    }
    this.flight.clearInputs();
    this.geoFocusTween = null;

    if (bodyId === 'earth') {
      this.focusedBodyId = 'earth';
      const saved = this.savedViews.get('earth');
      if (saved) {
        this.restorePose(saved);
      } else {
        this.resetOverview(false);
      }
      return;
    }

    const currentDirection = this.camera.position.clone().sub(body.position);
    if (currentDirection.lengthSq() < 1e-8) {
      currentDirection.copy(OVERVIEW_TARGET).sub(body.position);
    }
    currentDirection.normalize();

    // Moon and Mars are viewed from the Earth-facing side so the visible phase
    // corresponds to the geocentric reference phase. Other bodies use the
    // current approach direction.
    const direction =
      bodyId === 'moon' || bodyId === 'mars'
        ? body.position.clone().negate().normalize()
        : currentDirection;

    const distance = Math.max(body.radius * 4.6, body.radius + 1.5);
    const toPosition = body.position.clone().addScaledVector(direction, distance);
    const toQuaternion = quaternionLookingAt(toPosition, body.position);
    this.focusedBodyId = bodyId;
    this.startTween(toPosition, toQuaternion);
  }

  resetOverview(rememberCurrent = true): void {
    if (rememberCurrent) {
      this.rememberCurrentView();
    }
    this.flight.clearInputs();
    this.geoFocusTween = null;
    this.focusedBodyId = 'earth';
    this.savedViews.set('earth', {
      position: OVERVIEW_POSITION.clone(),
      quaternion: OVERVIEW_QUATERNION.clone(),
    });
    this.startTween(OVERVIEW_POSITION.clone(), OVERVIEW_QUATERNION.clone());
  }

  setManualTranslation(axis: TranslationAxis, active: boolean): void {
    if (!this.active || this.tween || this.geoFocusTween) return;
    this.flight.setTranslation(axis, active);
  }

  setManualRotation(axis: RotationAxis, active: boolean): void {
    if (!this.active || this.tween || this.geoFocusTween) return;
    this.flight.setRotation(axis, active);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.flight.setEnabled(active);
    this.loop.setPaused(!active);
    if (active) {
      this.resize();
    }
  }

  /** Diagnostics harness; compiled to a no-op outside development builds. */
  installDiagnosticProbes(): void {
    this.installLightingProbe();
    this.installFlightProbe();
  }

  private rememberCurrentView(): void {
    if (!this.focusedBodyId) return;
    this.savedViews.set(this.focusedBodyId, {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
    });
  }

  private restorePose(pose: CameraPose): void {
    this.startTween(pose.position.clone(), pose.quaternion.clone());
  }

  setLowPower(enabled: boolean): void {
    this.lowPower = enabled;
    this.renderer.setPixelRatio(materialPixelRatio(enabled));
    this.resize();
  }

  private readLightingSnapshot(): FreeExploreLightingSnapshot {
    const moon = this.visual.bodies.get('moon');
    const mars = this.visual.bodies.get('mars');
    if (!moon || !mars) {
      throw new Error('Lighting snapshot requested before bodies were created.');
    }
    return {
      earthLocalSunDirection: this.visual.earthSunDirection.toArray(),
      osmLocalSunDirection: this.globeTiles.sunDirection.toArray(),
      moonSceneSunDirection: this.visual.moonSunDirection.toArray(),
      marsSceneSunDirection: this.visual.marsSunDirection.toArray(),
      moonPosition: moon.position.toArray(),
      marsPosition: mars.position.toArray(),
      cameraPosition: this.camera.position.toArray(),
      cameraQuaternion: this.camera.quaternion.toArray(),
    };
  }

  private readFlightSnapshot(): FlightSnapshot {
    const forward = cameraForward(this.camera);
    return {
      position: this.camera.position.toArray(),
      quaternion: this.camera.quaternion.toArray(),
      forward: forward.toArray(),
      velocity: this.flight.velocity.toArray(),
      viewTarget: this.viewTarget.toArray(),
      selectedBodyId: this.selectedBodyId,
      focusedBodyId: this.focusedBodyId,
      active: this.active,
    };
  }

  private installFlightProbe(): void {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    (
      window as Window & {
        __cosmosFlight?: () => FlightSnapshot;
      }
    ).__cosmosFlight = this.flightProbe;
  }

  private removeFlightProbe(): void {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const scope = window as Window & {
      __cosmosFlight?: () => FlightSnapshot;
    };
    if (scope.__cosmosFlight === this.flightProbe) {
      delete scope.__cosmosFlight;
    }
  }

  private installLightingProbe(): void {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    (
      window as Window & {
        __cosmosLighting?: () => FreeExploreLightingSnapshot;
      }
    ).__cosmosLighting = this.lightingProbe;
  }

  private removeLightingProbe(): void {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const scope = window as Window & {
      __cosmosLighting?: () => FreeExploreLightingSnapshot;
    };
    if (scope.__cosmosLighting === this.lightingProbe) {
      delete scope.__cosmosLighting;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeLightingProbe();
    this.removeFlightProbe();
    this.loop.stop();
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointercancel', this.handlePointerCancel);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );
    document.removeEventListener('keydown', this.handleNavigateKeyDown);
    document.removeEventListener('keyup', this.handleNavigateKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    for (const label of this.bodyLabels.values()) {
      label.removeFromParent();
      label.element.remove();
    }
    this.bodyLabels.clear();
    this.labelRenderer.domElement.remove();
    this.earthDetail.dispose();
    this.globeTiles.dispose();
    this.locationLayer.dispose();
    disposeObjectTree(this.scene);
    const canvas = this.renderer.domElement;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    removeCanvas(canvas);
  }

  private startTween(
    toPosition: THREE.Vector3,
    toQuaternion: THREE.Quaternion,
  ): void {
    this.geoFocusTween = null;
    this.flight.clearInputs();
    this.flight.setEnabled(false);
    this.tween = {
      startSeconds: this.elapsedSeconds,
      durationSeconds: this.prefersReducedMotion ? 0.2 : 0.9,
      fromPosition: this.camera.position.clone(),
      toPosition,
      fromQuaternion: this.camera.quaternion.clone(),
      toQuaternion,
    };
  }

  private startGeoFocus(
    toDirection: THREE.Vector3,
    distance: number,
    toQuaternion: THREE.Quaternion,
  ): void {
    this.tween = null;
    this.flight.clearInputs();
    this.flight.setEnabled(false);
    const fromDirection = this.camera.position.clone().normalize();
    const fromDistance = this.camera.position.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      fromDirection,
      toDirection,
    );
    this.geoFocusTween = {
      startSeconds: this.elapsedSeconds,
      durationSeconds: this.prefersReducedMotion ? 0.2 : 1.15,
      fromDirection,
      toDirection: toDirection.clone(),
      fromDistance: Math.max(fromDistance, distance),
      toDistance: Math.max(distance, 1.0006),
      rotation,
      fromQuaternion: this.camera.quaternion.clone(),
      toQuaternion: toQuaternion.clone(),
    };
  }

  private updateAstronomy(force = false): void {
    const nowMs = Date.now();
    if (!force && nowMs - this.lastAstronomyUpdateMs < 30_000) {
      return;
    }
    this.lastAstronomyUpdateMs = nowMs;
    this.visual.applyReferenceFrame(computeReferenceFrame(this.clock.nowUtc()));
    this.updateSelectionRing();
  }

  private nearestSurfaceGap(): number {
    let nearest = Infinity;
    for (const body of this.visual.bodies.values()) {
      nearest = Math.min(
        nearest,
        this.camera.position.distanceTo(body.position) - body.radius,
      );
    }
    return Math.max(nearest, 0.0001);
  }

  private motionScale(): number {
    return computeProximityMotionScale(this.nearestSurfaceGap());
  }

  private lookRadiansPerPixel(): number {
    const viewportHeight = Math.max(this.viewportHeight, 1);
    const earth = this.visual.bodies.get('earth');
    const gap = this.nearestSurfaceGap();
    if (earth) {
      const earthDistance = this.camera.position.distanceTo(earth.position);
      const earthGap = earthDistance - earth.radius;
      if (earthGap <= gap + 1e-6 && earthGap < 8) {
        const navigation = computeEarthNavigationSensitivity(
          Math.max(earthDistance, 1.0001),
          this.camera.fov,
        );
        return (Math.PI * 2 * navigation.rotateSpeed) / viewportHeight;
      }
    }
    const proximity = THREE.MathUtils.clamp(gap / 8, 0.25, 1);
    return (Math.PI * 2 * 0.55 * proximity) / viewportHeight;
  }

  private applyLookPixels(dx: number, dy: number): void {
    const sensitivity = this.lookRadiansPerPixel();
    this.flight.applyLook(dx * sensitivity, -dy * sensitivity, 0);
  }

  private dollyByPixels(pixels: number): void {
    const gap = this.nearestSurfaceGap();
    this.flight.addForwardImpulse(pixels * (0.0004 + gap * 0.0012));
  }

  private panByPixels(dx: number, dy: number, scale: number): void {
    this.flight.addScreenImpulse(dx, dy, scale * this.motionScale());
  }

  private readonly handleNavigateKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')
    ) {
      return;
    }
    if (document.querySelector('.sheet-backdrop')) return;

    if (event.key === 'Shift') {
      this.flight.setBoost(true);
      return;
    }

    const bodyId = KEYBOARD_BODY_IDS[event.code];
    if (bodyId) {
      event.preventDefault();
      this.options.onSelectBody?.(bodyId);
      return;
    }

    if (event.code === 'Home' || event.code === 'Digit0') {
      event.preventDefault();
      this.resetOverview();
      return;
    }

    if (
      event.code === 'Equal' ||
      event.code === 'NumpadAdd' ||
      event.key === '+'
    ) {
      event.preventDefault();
      this.dollyByPixels(KEY_DOLLY_PIXELS);
      return;
    }
    if (
      event.code === 'Minus' ||
      event.code === 'NumpadSubtract' ||
      event.key === '-'
    ) {
      event.preventDefault();
      this.dollyByPixels(-KEY_DOLLY_PIXELS);
      return;
    }

    const translation = KEYBOARD_TRANSLATION[event.code];
    if (translation) {
      event.preventDefault();
      this.flight.setTranslation(translation, true);
      return;
    }

    const rotation = KEYBOARD_ROTATION[event.code];
    if (rotation) {
      event.preventDefault();
      this.flight.setRotation(rotation, true);
    }
  };

  private readonly handleNavigateKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Shift') {
      this.flight.setBoost(false);
    }
    const translation = KEYBOARD_TRANSLATION[event.code];
    if (translation) {
      this.flight.setTranslation(translation, false);
    }
    const rotation = KEYBOARD_ROTATION[event.code];
    if (rotation) {
      this.flight.setRotation(rotation, false);
    }
  };

  private readonly handleWindowBlur = (): void => {
    this.flight.clearInputs();
  };

  private enforceEarthCollision(): void {
    this.flight.clampPosition();
  }

  private updateViewTarget(): void {
    const earth = this.visual.bodies.get('earth');
    const distance = earth
      ? this.camera.position.distanceTo(earth.position)
      : this.camera.position.length();
    cameraForward(this.camera, this.viewTarget);
    this.viewTarget
      .multiplyScalar(Math.max(distance, 0.001))
      .add(this.camera.position);
  }

  private updateEarthProximity(): void {
    const distance = this.camera.position.length();
    const lookingAtEarth = this.viewTarget.lengthSq() < 0.0625;
    const earthDetailActive = lookingAtEarth && distance < 3.2;
    const height = Math.max(distance - 1, 0.0003);
    const near = earthDetailActive
      ? Math.max(0.00012, height * 0.25)
      : 0.05;
    const far = earthDetailActive
      ? Math.max(0.5, height * 25 + 0.5)
      : 1200;
    if (Math.abs(this.camera.near - near) > 1e-7 || Math.abs(this.camera.far - far) > 1e-3) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }

    // No background bodies may show through the local Earth view. The base is
    // opaque; hiding the distant starfield also keeps the night side readable.
    this.starfield.visible = !earthDetailActive;
    this.visual.earthAtmosphere.visible = !(lookingAtEarth && distance < 1.15);
    this.visual.selectionRing.visible =
      this.selectedBodyId !== null && !(lookingAtEarth && distance < 2.1);
  }

  private renderFrame(elapsed: number, delta: number): void {
    this.elapsedSeconds = elapsed;

    if (this.geoFocusTween) {
      const tween = this.geoFocusTween;
      const rawProgress = Math.min(
        1,
        Math.max(0, (elapsed - tween.startSeconds) / tween.durationSeconds),
      );
      const progress = easeInOutCubic(rawProgress);
      const partialRotation = new THREE.Quaternion().slerpQuaternions(
        new THREE.Quaternion(),
        tween.rotation,
        progress,
      );
      const direction = tween.fromDirection
        .clone()
        .applyQuaternion(partialRotation)
        .normalize();
      const distance = THREE.MathUtils.lerp(
        tween.fromDistance,
        tween.toDistance,
        progress,
      );
      this.camera.position.copy(direction.multiplyScalar(distance));
      this.camera.quaternion.slerpQuaternions(
        tween.fromQuaternion,
        tween.toQuaternion,
        progress,
      );
      if (rawProgress >= 1) {
        this.geoFocusTween = null;
        this.flight.setEnabled(true);
      }
    } else if (this.tween) {
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
      this.camera.quaternion.slerpQuaternions(
        this.tween.fromQuaternion,
        this.tween.toQuaternion,
        progress,
      );
      if (rawProgress >= 1) {
        this.tween = null;
        this.flight.setEnabled(true);
      }
    } else {
      this.flight.update(delta, this.motionScale());
    }

    this.enforceEarthCollision();
    this.updateViewTarget();
    this.camera.updateMatrixWorld();
    this.updateEarthProximity();
    this.updateAstronomy();
    // Do not request tile sets for intermediate camera positions during a
    // fly-to. Detail fades still advance every frame.
    this.earthDetail.update({
      camera: this.camera,
      earthGroup: this.visual.earthSpinGroup,
      target: this.viewTarget,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      pixelRatio: this.renderer.getPixelRatio(),
      allowSelection: !this.geoFocusTween && !this.tween,
    });
    if (!this.geoFocusTween && !this.tween) {
      this.globeTiles.update({
        camera: this.camera,
        earthGroup: this.visual.earthSpinGroup,
        target: this.viewTarget,
        viewportWidth: this.viewportWidth,
        viewportHeight: this.viewportHeight,
        deltaSeconds: delta,
      });
    }
    if (!this.prefersReducedMotion) {
      this.visual.update(elapsed, delta, this.lowPower);
    }
    this.updateBodyLabels();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.labelScene, this.camera);
  }

  private resize(): void {
    if (this.disposed || !this.active) return;
    const width = Math.max(this.options.container.clientWidth, 1);
    const height = Math.max(this.options.container.clientHeight, 1);
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(materialPixelRatio(this.lowPower));
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
  }

  private updateRaycaster(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.active || this.tween || this.geoFocusTween) return;
    if (event.pointerType === 'mouse' && ![0, 1, 2].includes(event.button)) return;
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
    this.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    this.renderer.domElement.style.cursor = 'grabbing';

    if (this.activePointers.size === 1) {
      this.multiTouch = null;
      const mode: 'look' | 'pan' | 'roll' =
        event.pointerType !== 'touch' && event.button === 2
          ? 'pan'
          : event.pointerType !== 'touch' && event.button === 1
            ? 'roll'
            : 'look';
      this.pointerDown = {
        id: event.pointerId,
        button: event.button,
        pointerType: event.pointerType,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        time: performance.now(),
        moved: 0,
      };
      return;
    }

    if (this.activePointers.size === 2) {
      const [first, second] = [...this.activePointers.values()];
      if (first && second) {
        this.multiTouch = {
          centerX: (first.x + second.x) / 2,
          centerY: (first.y + second.y) / 2,
          distance: Math.hypot(first.x - second.x, first.y - second.y),
        };
      }
      this.pointerDown = null;
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.activePointers.has(event.pointerId)) {
      if (event.pointerType === 'mouse' && this.activePointers.size === 0) {
        this.updateRaycaster(event);
        const hits = this.raycaster.intersectObjects(
          this.visual.interactiveMeshes,
          false,
        );
        this.renderer.domElement.style.cursor =
          hits.length > 0 ? 'pointer' : 'grab';
      }
      return;
    }

    const previous = this.activePointers.get(event.pointerId);
    if (!previous) return;
    this.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (this.multiTouch && this.activePointers.size >= 2) {
      const [first, second] = [...this.activePointers.values()];
      if (first && second) {
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        const distanceDelta = distance - this.multiTouch.distance;
        if (Math.abs(distanceDelta) > 0.5) {
          this.dollyByPixels(distanceDelta);
        }
        this.panByPixels(
          centerX - this.multiTouch.centerX,
          centerY - this.multiTouch.centerY,
          TOUCH_PAN_SCALE,
        );
        this.multiTouch = { centerX, centerY, distance };
      }
      return;
    }

    const gesture = this.pointerDown;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.lastX;
    const dy = event.clientY - gesture.lastY;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    gesture.moved += Math.hypot(dx, dy);

    if (gesture.mode === 'look') {
      this.applyLookPixels(dx, dy);
    } else if (gesture.mode === 'pan') {
      this.panByPixels(dx, dy, DRAG_PAN_SCALE);
    } else {
      const sensitivity = this.lookRadiansPerPixel();
      this.flight.applyLook(0, 0, dx * sensitivity * 0.8);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const gesture = this.pointerDown;
    const wasSinglePointer = this.activePointers.size === 1;
    this.activePointers.delete(event.pointerId);
    this.renderer.domElement.releasePointerCapture?.(event.pointerId);
    if (this.activePointers.size < 2) this.multiTouch = null;
    if (this.activePointers.size === 0) {
      this.pointerDown = null;
      this.renderer.domElement.style.cursor = 'grab';
    }

    if (
      !gesture ||
      !wasSinglePointer ||
      gesture.id !== event.pointerId ||
      gesture.moved > 8 ||
      performance.now() - gesture.time > 900 ||
      gesture.button !== 0 ||
      this.tween ||
      this.geoFocusTween
    ) {
      return;
    }

    this.updateRaycaster(event);
    const hits = this.raycaster.intersectObjects(this.visual.interactiveMeshes, false);
    const bodyId = hits[0]?.object.userData.bodyId;
    if (typeof bodyId === 'string') {
      this.options.onSelectBody?.(bodyId);
    }
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    this.renderer.domElement.releasePointerCapture?.(event.pointerId);
    if (this.activePointers.size < 2) this.multiTouch = null;
    if (this.activePointers.size === 0) {
      this.pointerDown = null;
      this.renderer.domElement.style.cursor = 'grab';
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (!this.active || this.tween || this.geoFocusTween) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const modeScale =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
    const delta = THREE.MathUtils.clamp(
      -event.deltaY * modeScale,
      -900,
      900,
    );
    this.dollyByPixels(delta);
  };

  private readonly handleContextMenu = (event: Event): void => {
    event.preventDefault();
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
