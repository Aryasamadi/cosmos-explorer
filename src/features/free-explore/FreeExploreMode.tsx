import { useCallback, useEffect, useRef, useState } from 'react';
import { getBodyById, getFreeExploreBodies } from '../../catalog/bodies';
import { useAppDispatch, useAppState } from '../../app/AppStateContext';
import {
  formatAccuracy,
  formatNumber,
  formatObserverLocation,
} from '../../app/format';
import { DISPLAY_SCALE_NOTICE_FA } from '../../config/display';
import { FreeExploreScene } from '../../engine/free/FreeExploreScene';
import type { MapDetailStatus } from '../../engine/free/globeTiles';
import type { EarthDetailStatus } from '../../engine/free/earthDetailLayer';
import type { GeoLocation } from '../../geo/types';
import { COARSE_ACCURACY_THRESHOLD_M } from '../../geo/locationService';
import { OSM_RASTER_TILES } from '../../geo/tiles/tileProvider';
import { useWebGLSupport } from '../../hooks/useWebGLSupport';
import { CelestialInfoPanel } from '../celestial-info/CelestialInfoPanel';
import { EarthLocationSheet } from './EarthLocationSheet';
import { IconGlobe, IconInfo, IconPin, IconReset, IconTarget } from '../../components/Icons';
import { SceneFallback } from '../../components/SceneFallback';

type SceneStatus = 'loading' | 'ready' | 'error';

const EMPTY_MAP_STATUS: MapDetailStatus = {
  phase: 'idle',
  zoom: null,
  loadedTiles: 0,
  failedTiles: 0,
};

const EMPTY_EARTH_DETAIL_STATUS: EarthDetailStatus = {
  phase: 'idle',
  level: null,
  loadedTiles: 0,
  failedTiles: 0,
  desiredTiles: 0,
  atMaxLevel: false,
};

export function FreeExploreMode({ active }: { active: boolean }) {
  const {
    freeSelectedBodyId: selectedBodyId,
    infoOpen,
    lowPower,
    location,
  } = useAppState();
  const dispatch = useAppDispatch();
  const support = useWebGLSupport();
  const sceneRef = useRef<FreeExploreScene | null>(null);
  const pendingGeoFocusRef = useRef(false);
  const [status, setStatus] = useState<SceneStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [mapOverlayEnabled, setMapOverlayEnabled] = useState(true);
  const [scaleHelpOpen, setScaleHelpOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState<MapDetailStatus>(EMPTY_MAP_STATUS);
  const [earthDetailStatus, setEarthDetailStatus] = useState<EarthDetailStatus>(
    EMPTY_EARTH_DETAIL_STATUS,
  );

  const selectedBody = selectedBodyId ? getBodyById(selectedBodyId) : undefined;
  const freeBodies = getFreeExploreBodies();
  const effectiveStatus: SceneStatus = support.supported ? status : 'error';
  const effectiveError = support.supported
    ? errorMessage
    : support.reasonFa ?? 'WebGL در دسترس نیست.';

  useEffect(() => {
    if (!hintVisible) return;
    const timer = window.setTimeout(() => setHintVisible(false), 9000);
    return () => window.clearTimeout(timer);
  }, [hintVisible]);

  useEffect(() => {
    if (!scaleHelpOpen) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setScaleHelpOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [scaleHelpOpen]);

  const attachScene = useCallback(
    (node: HTMLDivElement | null): (() => void) | undefined => {
      if (!node || !support.supported) return undefined;
      let cancelled = false;

      void FreeExploreScene.create({
        container: node,
        onSelectBody: (bodyId) => dispatch({ type: 'select-body', bodyId }),
        onMapStatus: setMapStatus,
        onEarthDetailStatus: setEarthDetailStatus,
        onContextLost: () => setContextLost(true),
        onContextRestored: () => setContextLost(false),
      })
        .then((scene) => {
          if (cancelled) {
            scene.dispose();
            return;
          }
          sceneRef.current = scene;
          setStatus('ready');
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setStatus('error');
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'ساخت صحنه با خطای نامشخص متوقف شد.',
          );
        });

      return () => {
        cancelled = true;
        sceneRef.current?.dispose();
        sceneRef.current = null;
      };
    },
    [dispatch, support.supported],
  );

  useEffect(() => {
    if (status === 'ready') {
      sceneRef.current?.setLowPower(lowPower);
    }
  }, [lowPower, status]);

  useEffect(() => {
    if (status === 'ready') {
      sceneRef.current?.setMapOverlayEnabled(mapOverlayEnabled);
    }
  }, [mapOverlayEnabled, status]);

  useEffect(() => {
    if (status !== 'ready') return;
    if (!selectedBodyId) {
      sceneRef.current?.selectBody(null);
      return;
    }
    sceneRef.current?.selectBody(selectedBodyId);
    sceneRef.current?.focusBody(selectedBodyId);
  }, [selectedBodyId, status]);

  useEffect(() => {
    if (status !== 'ready') return;
    sceneRef.current?.setActive(active);
  }, [active, status]);

  useEffect(() => {
    if (status !== 'ready') return;
    sceneRef.current?.setGeographicLocation(location);
    if (location && pendingGeoFocusRef.current) {
      sceneRef.current?.focusGeographicLocation(location);
      pendingGeoFocusRef.current = false;
    }
  }, [location, status]);

  const handleSelectBody = useCallback(
    (bodyId: string) => {
      setHintVisible(false);
      dispatch({ type: 'select-body', bodyId });
    },
    [dispatch],
  );

  const handleUseLocation = useCallback(
    (nextLocation: GeoLocation) => {
      const isCoarseDeviceFix =
        nextLocation.source === 'device' &&
        nextLocation.accuracyM !== null &&
        nextLocation.accuracyM > COARSE_ACCURACY_THRESHOLD_M;
      pendingGeoFocusRef.current = !isCoarseDeviceFix;
      dispatch({ type: 'set-location', location: nextLocation });
    },
    [dispatch],
  );

  const handleUpdateLocation = useCallback(
    (nextLocation: GeoLocation) => {
      dispatch({ type: 'set-location', location: nextLocation });
    },
    [dispatch],
  );

  const handleFocusLocation = useCallback((location: GeoLocation) => {
    sceneRef.current?.focusGeographicLocation(location);
  }, []);

  const handleClearLocation = useCallback(() => {
    dispatch({ type: 'clear-location' });
    sceneRef.current?.clearGeographicLocation();
  }, [dispatch]);

  const handleRetry = (): void => {
    setStatus('loading');
    setErrorMessage(null);
    setContextLost(false);
    setMapStatus(EMPTY_MAP_STATUS);
    setEarthDetailStatus(EMPTY_EARTH_DETAIL_STATUS);
    setAttempt((value) => value + 1);
  };

  const earthDetailText =
    earthDetailStatus.phase === 'loading'
      ? 'در حال بارگذاری تصویر ماهواره‌ای با جزئیات بالاتر…'
      : earthDetailStatus.phase === 'ready'
        ? earthDetailStatus.atMaxLevel
          ? 'تصویر ماهواره‌ای NASA Blue Marble · بالاترین جزئیات تصویر'
          : `تصویر ماهواره‌ای NASA Blue Marble · سطح ${formatNumber(
              earthDetailStatus.level ?? 0,
              0,
            )}`
        : earthDetailStatus.phase === 'error'
          ? 'جزئیات تصویر ماهواره‌ای در دسترس نیست؛ کرهٔ پایه نمایش داده می‌شود.'
          : null;

  const locationAccuracyText = location
    ? location.source === 'manual'
      ? 'مختصات دستی؛ دقت دستگاه نامشخص'
      : formatAccuracy(location.accuracyM)
    : null;
  const mapAttributionVisible =
    mapOverlayEnabled && mapStatus.phase !== 'idle';

  return (
    <section
      className="mode-panel free-mode"
      aria-label="کاوش آزاد"
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home 0 1 2 3 4 + -"
      hidden={!active}
    >
      <div
        key={attempt}
        className="scene-host"
        ref={attachScene}
        data-testid="free-scene-host"
      />

      <div className="scene-top-hud">
        <button
          type="button"
          className="scale-badge"
          title={DISPLAY_SCALE_NOTICE_FA}
          aria-label={DISPLAY_SCALE_NOTICE_FA}
          aria-expanded={scaleHelpOpen}
          aria-controls="free-scale-help"
          onClick={() => setScaleHelpOpen((value) => !value)}
        >
          <IconInfo size={16} />
          <span>مقیاس نمایشی</span>
        </button>
        {scaleHelpOpen ? (
          <div id="free-scale-help" className="scale-help glass" role="note">
            <p>{DISPLAY_SCALE_NOTICE_FA}</p>
            <button
              type="button"
              className="scale-help__close"
              onClick={() => setScaleHelpOpen(false)}
              aria-label="بستن توضیح مقیاس"
            >
              ×
            </button>
          </div>
        ) : null}
      </div>

      {mapAttributionVisible ? (
        <a
          className="map-attribution-corner"
          href={OSM_RASTER_TILES.attributionUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          {OSM_RASTER_TILES.attributionText}
        </a>
      ) : null}

      {effectiveStatus === 'loading' ? (
        <div className="scene-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>در حال ساخت زمین و اجرام منظومهٔ شمسی…</p>
        </div>
      ) : null}

      {effectiveStatus === 'error' ? (
        <div className="scene-overlay-center">
          <SceneFallback
            title="نمایش صحنهٔ سه‌بعدی ممکن نشد"
            message={effectiveError ?? 'WebGL در دسترس نیست.'}
            extra="از مرورگر جدیدتر استفاده کنید و در تنظیمات مرورگر، شتاب سخت‌افزاری را فعال نگه دارید. پنل اطلاعات اجرام همچنان در دسترس است."
            onRetry={support.supported ? handleRetry : undefined}
          />
        </div>
      ) : null}

      {contextLost && effectiveStatus === 'ready' ? (
        <div className="scene-overlay-center">
          <div className="scene-fallback glass" role="alert">
            <span className="scene-fallback__icon">
              <IconGlobe size={28} />
            </span>
            <h2>اتصال گرافیکی موقتاً قطع شد</h2>
            <p>در حال تلاش برای بازیابی صحنه. اگر صحنه برنگشت، صفحه را دوباره بارگذاری کنید.</p>
          </div>
        </div>
      ) : null}

      <div className="free-top-actions">
        <button
          type="button"
          className="button button--glass"
          onClick={() => {
            sceneRef.current?.resetOverview();
            setHintVisible(false);
          }}
        >
          <IconReset size={18} />
          نمای کلی
        </button>
        <button
          type="button"
          className="button button--glass"
          onClick={() => dispatch({ type: 'toggle-info' })}
          aria-pressed={infoOpen}
        >
          <IconInfo size={18} />
          اطلاعات
        </button>
      </div>

      {mapStatus.phase === 'loading' ? (
        <div className="map-loading-chip" role="status">
          <span className="spinner" aria-hidden="true" />
          در حال بارگذاری جزئیات نقشه…
        </div>
      ) : null}

      <div className="free-bottom">
        {hintVisible ? (
          <div className="hint-bubble" role="status">
            برای چرخش بکشید؛ برای جزئیات، یک جرم را لمس کنید.
            <button
              type="button"
              className="hint-bubble__close"
              onClick={() => setHintVisible(false)}
              aria-label="بستن راهنما"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="earth-location-row">
          <button
            type="button"
            className={`earth-location-pill ${location ? 'has-location' : ''}`}
            onClick={() => setLocationSheetOpen(true)}
            aria-label={
              location
                ? `موقعیت شما: ${formatObserverLocation(location)}. ${locationAccuracyText ?? ''}`
                : 'موقعیت من روی زمین'
            }
          >
            <IconPin size={16} />
            {location ? (
              <span className="earth-location-pill__text">
                <span className="earth-location-pill__title">
                  موقعیت شما
                  <small>{locationAccuracyText}</small>
                </span>
                <span className="earth-location-pill__coords">
                  {formatObserverLocation(location)}
                </span>
              </span>
            ) : (
              <span className="earth-location-pill__label">موقعیت من روی زمین</span>
            )}
          </button>
        </div>
        {mapStatus.phase === 'loading' ? (
          <p className="earth-map-status" role="status">
            در حال بارگذاری جزئیات نقشه…
          </p>
        ) : mapStatus.phase === 'error' ? (
          <p className="earth-map-status earth-map-status--error" role="status">
            جزئیات نقشه بارگذاری نشد؛ کرهٔ پایه نمایش داده می‌شود.
          </p>
        ) : mapStatus.phase === 'ready' && mapStatus.zoom !== null ? (
          <p className="earth-map-status">
            جزئیات نقشه فعال · سطح {formatNumber(mapStatus.zoom, 0)}
          </p>
        ) : null}
        {earthDetailText ? (
          <p className="earth-imagery-status" role="status">
            {earthDetailText}
          </p>
        ) : null}
        <div className="body-pills" role="group" aria-label="انتخاب جرم">
          {freeBodies.map((body) => {
            const selected = body.id === selectedBodyId;
            return (
              <button
                key={body.id}
                type="button"
                className={`body-pill ${selected ? 'is-selected' : ''}`}
                onClick={() => handleSelectBody(body.id)}
                aria-pressed={selected}
              >
                <span
                  className="body-pill__swatch"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, #ffffffb0, transparent 58%), ${body.accentColor}`,
                  }}
                  aria-hidden="true"
                />
                <span>{body.nameFa}</span>
                {selected ? <IconTarget size={13} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {active && selectedBody ? (
        <CelestialInfoPanel
          body={selectedBody}
          mode="free"
          open={infoOpen}
          onClose={() => dispatch({ type: 'close-info' })}
        />
      ) : null}

      {locationSheetOpen ? (
        <EarthLocationSheet
          open
          onClose={() => setLocationSheetOpen(false)}
          location={location}
          onUseLocation={handleUseLocation}
          onUpdateLocation={handleUpdateLocation}
          onFocus={handleFocusLocation}
          onClear={handleClearLocation}
          mapOverlayEnabled={mapOverlayEnabled}
          onMapOverlayChange={setMapOverlayEnabled}
        />
      ) : null}
    </section>
  );
}
