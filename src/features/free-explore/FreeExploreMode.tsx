import { useCallback, useEffect, useRef, useState } from 'react';
import { getBodyById, getFreeExploreBodies } from '../../catalog/bodies';
import { useAppDispatch, useAppState } from '../../app/AppStateContext';
import { DISPLAY_SCALE_NOTICE_FA } from '../../config/display';
import { FreeExploreScene } from '../../engine/free/FreeExploreScene';
import { useWebGLSupport } from '../../hooks/useWebGLSupport';
import { CelestialInfoPanel } from '../celestial-info/CelestialInfoPanel';
import { IconGlobe, IconInfo, IconReset, IconTarget } from '../../components/Icons';
import { SceneFallback } from '../../components/SceneFallback';

type SceneStatus = 'loading' | 'ready' | 'error';

export function FreeExploreMode() {
  const { selectedBodyId, infoOpen, lowPower } = useAppState();
  const dispatch = useAppDispatch();
  const support = useWebGLSupport();
  const sceneRef = useRef<FreeExploreScene | null>(null);
  const [status, setStatus] = useState<SceneStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);

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

  const handleSelectBody = useCallback(
    (bodyId: string) => {
      setHintVisible(false);
      dispatch({ type: 'select-body', bodyId });
    },
    [dispatch],
  );

  const handleRetry = (): void => {
    setStatus('loading');
    setErrorMessage(null);
    setContextLost(false);
    setAttempt((value) => value + 1);
  };

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
    </section>
  );
}
