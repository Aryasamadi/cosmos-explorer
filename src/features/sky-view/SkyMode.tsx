import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ObserverLocation, SkySnapshot } from '../../astronomy/types';
import { computeSkySnapshot, getPosition } from '../../astronomy/ephemeris/skySnapshot';
import { appSimulationClock } from '../../astronomy/simulationClock';
import {
  describeDeviceLocationErrorFa,
  DeviceLocationError,
} from '../../geo/deviceLocation';
import {
  geoLocationToObserver,
  observerLocationToGeo,
} from '../../geo/locationAdapters';
import { acquireSharedLocation } from '../../geo/locationService';
import { getBodyById, getSkyBodies } from '../../catalog/bodies';
import { useAppDispatch, useAppState } from '../../app/AppStateContext';
import {
  LIGHT_LEVEL_FA,
  compassDirectionFa,
  formatAngle,
  formatLocalDateTime,
  formatObserverLocation,
} from '../../app/format';
import {
  applyHeadingOffset,
  buildCameraQuaternion,
  type OrientationSample,
} from '../../sensors/orientationMath';
import type { SkyScene } from '../../engine/sky/SkyScene';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { useCameraOverlay } from '../../hooks/useCameraOverlay';
import { CelestialInfoPanel } from '../celestial-info/CelestialInfoPanel';
import { Notice } from '../../components/Notice';
import { IconCamera, IconClock, IconGear, IconList, IconSensor, IconPin } from '../../components/Icons';
import { ObserverSetup } from './ObserverSetup';
import { SkyViewport } from './SkyViewport';
import { SkyObjectsSheet } from './SkyObjectsSheet';
import { SkySettingsSheet } from './SkySettingsSheet';

type LocationStatus = 'idle' | 'requesting' | 'denied' | 'error';

export function SkyMode() {
  const { selectedBodyId, infoOpen, lowPower, location: savedLocation } = useAppState();
  const dispatch = useAppDispatch();
  const sceneRef = useRef<SkyScene | null>(null);
  const lastSampleRef = useRef<OrientationSample | null>(null);
  const headingOffsetRef = useRef(0);
  const snapshotRef = useRef<SkySnapshot | null>(null);
  const mountedRef = useRef(true);

  const observerLocation = useMemo(
    () => (savedLocation ? geoLocationToObserver(savedLocation) : null),
    [savedLocation],
  );
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => appSimulationClock.nowUtc());
  const [customDate, setCustomDate] = useState(() => appSimulationClock.nowUtc());
  const [liveTime, setLiveTime] = useState(true);
  const [headingOffset, setHeadingOffset] = useState(0);
  const [fov, setFov] = useState(65);
  const [showGrid, setShowGrid] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [objectsOpen, setObjectsOpen] = useState(false);

  const {
    status: sensorStatus,
    enable: enableSensor,
    disable: disableSensor,
    subscribeReadings,
  } = useDeviceOrientation();
  const {
    videoRef: cameraVideoRef,
    status: cameraStatus,
    messageFa: cameraMessage,
    start: startCamera,
    stop: stopCamera,
  } = useCameraOverlay();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!liveTime || !observerLocation) return;
    const timer = window.setInterval(
      () => setNow(appSimulationClock.nowUtc()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [liveTime, observerLocation]);

  const effectiveDate = liveTime ? now : customDate;

  const snapshotResult = useMemo(() => {
    if (!observerLocation) return { snapshot: null, error: null as string | null };
    try {
      return {
        snapshot: computeSkySnapshot(effectiveDate, observerLocation),
        error: null as string | null,
      };
    } catch (error) {
      return {
        snapshot: null,
        error:
          error instanceof Error
            ? `محاسبهٔ موقعیت اجرام انجام نشد: ${error.message}`
            : 'محاسبهٔ موقعیت اجرام انجام نشد.',
      };
    }
  }, [effectiveDate, observerLocation]);
  const snapshot = snapshotResult.snapshot;

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const selectedBody = getBodyById(selectedBodyId);
  const selectedPosition = snapshot
    ? getPosition(snapshot, selectedBodyId) ?? null
    : null;
  const solarBodies = getSkyBodies().filter((body) => Boolean(body.ephemerisTarget));

  const requestLocation = useCallback(async (): Promise<void> => {
    setLocationStatus('requesting');
    setLocationMessage(null);
    try {
      const fix = await acquireSharedLocation({ mode: 'quick' });
      if (!mountedRef.current) return;
      dispatch({ type: 'set-location', location: fix });
      setLocationStatus('idle');
      setLocationMessage(null);
    } catch (error) {
      if (!mountedRef.current) return;
      const code = error instanceof DeviceLocationError ? error.code : 'error';
      setLocationStatus(code === 'permission-denied' ? 'denied' : 'error');
      setLocationMessage(describeDeviceLocationErrorFa(code));
    }
  }, [dispatch]);

  const applyManualLocation = useCallback(
    (nextLocation: ObserverLocation): void => {
      dispatch({
        type: 'set-location',
        location: observerLocationToGeo(nextLocation),
      });
      setLocationStatus('idle');
      setLocationMessage(null);
    },
    [dispatch],
  );

  const handleLiveTimeChange = (enabled: boolean): void => {
    if (enabled) {
      const current = appSimulationClock.nowUtc();
      setNow(current);
      setCustomDate(current);
    } else {
      setCustomDate(now);
    }
    setLiveTime(enabled);
  };

  const handleDateChange = (date: Date): void => {
    setCustomDate(date);
    setLiveTime(false);
  };

  useEffect(() => {
    return subscribeReadings((sample) => {
      lastSampleRef.current = sample;
      const quaternion = buildCameraQuaternion(sample);
      sceneRef.current?.setAttitude(
        applyHeadingOffset(quaternion, headingOffsetRef.current),
      );
    });
  }, [subscribeReadings]);

  useEffect(() => {
    if (sensorStatus.status !== 'active') {
      sceneRef.current?.setAttitude(null);
    }
  }, [sensorStatus.status]);

  useEffect(() => {
    headingOffsetRef.current = headingOffset;
    const sample = lastSampleRef.current;
    if (sample && sensorStatus.status === 'active') {
      const quaternion = buildCameraQuaternion(sample);
      sceneRef.current?.setAttitude(applyHeadingOffset(quaternion, headingOffset));
    }
  }, [headingOffset, sensorStatus.status]);

  const handleSensorToggle = async (): Promise<void> => {
    if (
      sensorStatus.status === 'active' ||
      sensorStatus.status === 'waiting' ||
      sensorStatus.status === 'requesting'
    ) {
      disableSensor();
      lastSampleRef.current = null;
      sceneRef.current?.setAttitude(null);
      return;
    }
    await enableSensor();
  };

  const handleCameraToggle = async (): Promise<void> => {
    if (cameraStatus === 'active' || cameraStatus === 'paused') {
      stopCamera();
      return;
    }
    await startCamera();
  };

  const cameraOverlayActive = cameraStatus === 'active' || cameraStatus === 'paused';
  const sensorOn =
    sensorStatus.status === 'active' ||
    sensorStatus.status === 'waiting' ||
    sensorStatus.status === 'requesting';
  const sensorLabel = (() => {
    switch (sensorStatus.status) {
      case 'active':
        return 'حسگر روشن';
      case 'waiting':
        return 'در انتظار حسگر';
      case 'requesting':
        return 'اجازهٔ حسگر…';
      default:
        return 'حسگر خاموش';
    }
  })();

  const handleSelectBody = useCallback(
    (bodyId: string) => {
      dispatch({ type: 'select-body', bodyId });
      const current = snapshotRef.current;
      const position = current ? getPosition(current, bodyId) : undefined;
      if (position?.isAboveHorizon) {
        sceneRef.current?.lookAtHorizontal(position.horizontal);
      }
    },
    [dispatch],
  );

  const showSensorNotice = Boolean(sensorStatus.messageFa);
  const cameraNoticeTone =
    cameraStatus === 'denied' || cameraStatus === 'error'
      ? 'danger'
      : cameraStatus === 'paused'
        ? 'info'
        : 'warning';

  return (
    <section className="mode-panel sky-mode" aria-label="آسمان واقعی">
      {!observerLocation ? (
        <ObserverSetup
          requesting={locationStatus === 'requesting'}
          errorMessage={locationMessage}
          onRequestLocation={() => void requestLocation()}
          onManualLocation={applyManualLocation}
        />
      ) : (
        <>
          <video
            ref={cameraVideoRef}
            className={`camera-feed ${cameraOverlayActive ? 'is-visible' : ''}`}
            autoPlay
            muted
            playsInline
            aria-hidden="true"
          />
          <SkyViewport
            sceneRef={sceneRef}
            snapshot={snapshot}
            selectedBodyId={selectedBodyId}
            lowPower={lowPower}
            showGrid={showGrid}
            cameraOverlayActive={cameraOverlayActive}
            fov={fov}
            onSelectBody={handleSelectBody}
            onFovChange={setFov}
          />

          <div className="sky-hud glass" data-testid="sky-hud">
            <div className="sky-hud__main">
              <span className="sky-hud__time">
                <IconClock size={15} />
                {formatLocalDateTime(effectiveDate)}
              </span>
              <span className={`light-chip light-chip--${snapshot?.lightLevel ?? 'night'}`}>
                {snapshot ? LIGHT_LEVEL_FA[snapshot.lightLevel] : 'در حال محاسبه'}
              </span>
            </div>
            <div className="sky-hud__meta">
              <span>
                <IconPin size={13} />
                {formatObserverLocation(observerLocation)}
              </span>
              {snapshot ? (
                <span>
                  خورشید: {formatAngle(snapshot.sunAltitudeDeg)} ·{' '}
                  {snapshot.sunAltitudeDeg >= 0 ? 'بالای افق' : 'زیر افق'}
                </span>
              ) : null}
            </div>
          </div>

          <div className="sky-bottom">
            <div className="sky-quick-bodies" role="group" aria-label="اجرام اصلی آسمان">
              {solarBodies.map((body) => {
                const position = snapshot
                  ? getPosition(snapshot, body.id)
                  : undefined;
                const above = position?.isAboveHorizon ?? false;
                return (
                  <button
                    key={body.id}
                    type="button"
                    className={`quick-body ${
                      selectedBodyId === body.id ? 'is-selected' : ''
                    } ${above ? '' : 'is-below'}`}
                    onClick={() => handleSelectBody(body.id)}
                    aria-pressed={selectedBodyId === body.id}
                  >
                    <span
                      className="quick-body__dot"
                      style={{ background: body.accentColor }}
                      aria-hidden="true"
                    />
                    <span className="quick-body__name">{body.nameFa}</span>
                    <span className="quick-body__alt">
                      {position
                        ? above
                          ? `${formatAngle(position.horizontal.altitudeDeg, 0)} ${compassDirectionFa(
                              position.horizontal.azimuthDeg,
                            )}`
                          : 'زیر افق'
                        : '—'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="sky-notices">
              {showSensorNotice ? (
                <Notice tone={sensorStatus.status === 'active' ? 'info' : 'warning'}>
                  {sensorStatus.messageFa}
                </Notice>
              ) : null}
              {cameraMessage ? (
                <Notice tone={cameraNoticeTone}>{cameraMessage}</Notice>
              ) : null}
              {snapshotResult.error ? (
                <Notice tone="danger">{snapshotResult.error}</Notice>
              ) : null}
              {snapshot && snapshot.issues.length > 0 ? (
                <Notice tone="warning">
                  محاسبهٔ برخی اجرام در این لحظه کامل نشد؛ بقیهٔ نمایش ادامه دارد.
                </Notice>
              ) : null}
            </div>

            <p className="sky-hint">
              {sensorOn
                ? 'با چرخاندن گوشی، جهت نمای آسمان تغییر می‌کند. برای کنترل لمسی، حسگر را خاموش کنید.'
                : 'برای چرخش آسمان انگشت را بکشید؛ با دو انگشت یا چرخ ماوس میدان دید را تغییر دهید.'}
            </p>

            <div className="sky-controls control-bar glass">
              <button
                type="button"
                className={`control-button ${sensorOn ? 'is-on' : ''}`}
                onClick={() => void handleSensorToggle()}
                disabled={sensorStatus.status === 'requesting'}
                aria-pressed={sensorOn}
                title="فعال یا خاموش‌کردن حسگر جهت‌یابی"
              >
                <IconSensor size={19} />
                <span>{sensorLabel}</span>
              </button>
              <button
                type="button"
                className={`control-button ${cameraOverlayActive ? 'is-on' : ''}`}
                onClick={() => void handleCameraToggle()}
                disabled={cameraStatus === 'requesting'}
                aria-pressed={cameraOverlayActive}
                title="لایهٔ تصویر دوربین"
              >
                <IconCamera size={19} />
                <span>
                  {cameraStatus === 'requesting'
                    ? 'اجازهٔ دوربین…'
                    : cameraOverlayActive
                      ? 'خاموش‌کردن دوربین'
                      : 'دوربین'}
                </span>
              </button>
              <button
                type="button"
                className="control-button"
                onClick={() => setObjectsOpen(true)}
                title="فهرست اجرام آسمان"
              >
                <IconList size={19} />
                <span>اجرام</span>
              </button>
              <button
                type="button"
                className="control-button"
                onClick={() => setSettingsOpen(true)}
                title="مکان، زمان و کالیبراسیون"
              >
                <IconGear size={19} />
                <span>مکان/زمان</span>
              </button>
            </div>
          </div>

          {selectedBody ? (
            <CelestialInfoPanel
              body={selectedBody}
              mode="sky"
              open={infoOpen}
              onClose={() => dispatch({ type: 'close-info' })}
              position={selectedPosition}
              timestamp={snapshot?.timestamp ?? effectiveDate}
            />
          ) : null}

          <SkyObjectsSheet
            open={objectsOpen}
            onClose={() => setObjectsOpen(false)}
            snapshot={snapshot}
            selectedBodyId={selectedBodyId}
            onSelect={handleSelectBody}
          />

          <SkySettingsSheet
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            location={observerLocation}
            locationStatus={locationStatus}
            locationMessage={locationMessage}
            onRequestLocation={requestLocation}
            onManualLocation={applyManualLocation}
            date={effectiveDate}
            liveTime={liveTime}
            onLiveTimeChange={handleLiveTimeChange}
            onDateChange={handleDateChange}
            headingOffset={headingOffset}
            onHeadingOffsetChange={setHeadingOffset}
            fov={fov}
            onFovChange={setFov}
            showGrid={showGrid}
            onShowGridChange={setShowGrid}
            sensorStatus={sensorStatus}
          />
        </>
      )}
    </section>
  );
}
