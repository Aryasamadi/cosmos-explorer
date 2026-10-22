import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ObserverLocation, SkySnapshot } from '../../astronomy/types';
import { computeSkySnapshot, getPosition } from '../../astronomy/ephemeris/skySnapshot';
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
  const { selectedBodyId, infoOpen, lowPower } = useAppState();
  const dispatch = useAppDispatch();
  const sceneRef = useRef<SkyScene | null>(null);
  const lastSampleRef = useRef<OrientationSample | null>(null);
  const headingOffsetRef = useRef(0);
  const snapshotRef = useRef<SkySnapshot | null>(null);
  const mountedRef = useRef(true);

  const [location, setLocation] = useState<ObserverLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [customDate, setCustomDate] = useState(() => new Date());
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
    if (!liveTime || !location) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [liveTime, location]);

  const effectiveDate = liveTime ? now : customDate;

  const snapshotResult = useMemo(() => {
    if (!location) return { snapshot: null, error: null as string | null };
    try {
      return {
        snapshot: computeSkySnapshot(effectiveDate, location),
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
  }, [effectiveDate, location]);
  const snapshot = snapshotResult.snapshot;

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const selectedBody = getBodyById(selectedBodyId);
  const selectedPosition = snapshot
    ? getPosition(snapshot, selectedBodyId) ?? null
    : null;
  const solarBodies = getSkyBodies().filter((body) => Boolean(body.ephemerisTarget));

  const requestLocation = useCallback((): void => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage(
        'این مرورگر API موقعیت مکانی را در اختیار برنامه قرار نمی‌دهد. مختصات را دستی وارد کنید.',
      );
      return;
    }
    setLocationStatus('requesting');
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mountedRef.current) return;
        const height = position.coords.altitude;
        setLocation({
          latitudeDeg: position.coords.latitude,
          longitudeDeg: position.coords.longitude,
          heightM: height !== null && Number.isFinite(height) ? height : 0,
          source: 'geolocation',
          accuracyM:
            Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined,
        });
        setLocationStatus('idle');
        setLocationMessage(null);
      },
      (error) => {
        if (!mountedRef.current) return;
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationMessage(
              'اجازهٔ دسترسی به موقعیت مکانی داده نشد. می‌توانید مختصات را دستی وارد کنید؛ برنامه به کار خود ادامه می‌دهد.',
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationMessage(
              'موقعیت مکانی در دسترس نیست. GPS یا سرویس مکان دستگاه را بررسی کنید یا مختصات را دستی وارد کنید.',
            );
            break;
          default:
            setLocationMessage(
              'دریافت موقعیت مکانی طول کشید و زمان‌بندی به پایان رسید. دوباره تلاش کنید یا مختصات را دستی وارد کنید.',
            );
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  const applyManualLocation = useCallback((nextLocation: ObserverLocation): void => {
    setLocation(nextLocation);
    setLocationStatus('idle');
    setLocationMessage(null);
  }, []);

  const handleLiveTimeChange = (enabled: boolean): void => {
    if (enabled) {
      const current = new Date();
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
      {!location ? (
        <ObserverSetup
          requesting={locationStatus === 'requesting'}
          errorMessage={locationMessage}
          onRequestLocation={requestLocation}
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
                {formatObserverLocation(location)}
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
            location={location}
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
