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
import type { GeoLocation } from '../../geo/types';
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

export function FreeExploreMode() {
  const { selectedBodyId, infoOpen, lowPower, earthLocation } = useAppState();
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
  const [mapStatus, setMapStatus] = useState<MapDetailStatus>(EMPTY_MAP_STATUS);

  const selectedBody = getBodyById(selectedBodyId);
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

  const attachScene = useCallback(
    (node: HTMLDivElement | null): (() => void) | undefined => {
      if (!node || !support.supported) return undefined;
      let cancelled = false;

      void FreeExploreScene.create({
        container: node,
        onSelectBody: (bodyId) => dispatch({ type: 'select-body', bodyId }),
        onMapStatus: setMapStatus,
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
    if (status !== 'ready') return;
    sceneRef.current?.selectBody(selectedBodyId);
    sceneRef.current?.focusBody(selectedBodyId);
  }, [selectedBodyId, status]);

  useEffect(() => {
    if (status !== 'ready') return;
    sceneRef.current?.setGeographicLocation(earthLocation);
    if (earthLocation && pendingGeoFocusRef.current) {
      sceneRef.current?.focusGeographicLocation(earthLocation);
      pendingGeoFocusRef.current = false;
    }
  }, [earthLocation, status]);

  const handleSelectBody = useCallback(
    (bodyId: string) => {
      setHintVisible(false);
      dispatch({ type: 'select-body', bodyId });
    },
    [dispatch],
  );

  const handleUseLocation = useCallback(
    (location: GeoLocation) => {
      pendingGeoFocusRef.current = true;
      dispatch({ type: 'set-earth-location', location });
    },
    [dispatch],
  );

  const handleUpdateLocation = useCallback(
    (location: GeoLocation) => {
      dispatch({ type: 'set-earth-location', location });
    },
    [dispatch],
  );

  const handleFocusLocation = useCallback((location: GeoLocation) => {
    sceneRef.current?.focusGeographicLocation(location);
  }, []);

  const handleClearLocation = useCallback(() => {
    dispatch({ type: 'clear-earth-location' });
    sceneRef.current?.clearGeographicLocation();
  }, [dispatch]);

  const handleRetry = (): void => {
    setStatus('loading');
    setErrorMessage(null);
    setContextLost(false);
    setAttempt((value) => value + 1);
  };

  const locationAccuracyText = earthLocation
    ? earthLocation.source === 'manual'
      ? 'مختصات دستی؛ دقت دستگاه نامشخص'
      : formatAccuracy(earthLocation.accuracyM)
    : null;

  return (
    <section className="mode-panel free-mode" aria-label="کاوش آزاد">
      <div
        key={attempt}
        className="scene-host"
        ref={attachScene}
        data-testid="free-scene-host"
      />

      <div className="scene-top-hud">
        <div className="scale-badge" title={DISPLAY_SCALE_NOTICE_FA}>
          <IconInfo size={15} />
          <span>مقیاس نمایشی فشرده</span>
        </div>
      </div>

      {mapStatus.phase !== 'idle' ? (
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
            برای چرخش بکشید؛ با دو انگشت یا چرخ ماوس بزرگ‌نمایی کنید. برای دیدن جزئیات، یک جرم
            را لمس کنید.
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
            className={`earth-location-pill ${earthLocation ? 'has-location' : ''}`}
            onClick={() => setLocationSheetOpen(true)}
            aria-label={
              earthLocation
                ? `موقعیت شما: ${formatObserverLocation(earthLocation)}. ${locationAccuracyText ?? ''}`
                : 'موقعیت من روی زمین'
            }
          >
            <IconPin size={16} />
            {earthLocation ? (
              <span className="earth-location-pill__text">
                <span className="earth-location-pill__title">
                  موقعیت شما
                  <small>{locationAccuracyText}</small>
                </span>
                <span className="earth-location-pill__coords">
                  {formatObserverLocation(earthLocation)}
                </span>
              </span>
            ) : (
              <span className="earth-location-pill__label">موقعیت من روی زمین</span>
            )}
          </button>
          <a
            className="osm-credit"
            href={OSM_RASTER_TILES.attributionUrl}
            target="_blank"
            rel="noreferrer noopener"
            title="جزئیات نقشه از OpenStreetMap"
          >
            {OSM_RASTER_TILES.attributionText}
          </a>
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
        <p className="free-caption">
          <IconGlobe size={13} />
          زمین در مرکز تجربه؛ خورشید، ماه و مریخ با مقیاس فشرده نمایش داده می‌شوند.
        </p>
      </div>

      {selectedBody ? (
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
          location={earthLocation}
          onUseLocation={handleUseLocation}
          onUpdateLocation={handleUpdateLocation}
          onFocus={handleFocusLocation}
          onClear={handleClearLocation}
        />
      ) : null}
    </section>
  );
}
