import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { SkySnapshot } from '../../astronomy/types';
import { SkyScene } from '../../engine/sky/SkyScene';
import { useWebGLSupport } from '../../hooks/useWebGLSupport';
import { SceneFallback } from '../../components/SceneFallback';

interface SkyViewportProps {
  sceneRef: RefObject<SkyScene | null>;
  snapshot: SkySnapshot | null;
  selectedBodyId: string;
  lowPower: boolean;
  showGrid: boolean;
  cameraOverlayActive: boolean;
  fov: number;
  onSelectBody: (bodyId: string) => void;
  onFovChange: (fov: number) => void;
}

export function SkyViewport({
  sceneRef,
  snapshot,
  selectedBodyId,
  lowPower,
  showGrid,
  cameraOverlayActive,
  fov,
  onSelectBody,
  onFovChange,
}: SkyViewportProps) {
  const support = useWebGLSupport();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const effectiveStatus = support.supported ? status : 'error';
  const effectiveError = support.supported
    ? errorMessage
    : support.reasonFa ?? 'WebGL در دسترس نیست.';

  const attachScene = useCallback(
    (node: HTMLDivElement | null): (() => void) | undefined => {
      if (!node || !support.supported) return undefined;
      try {
        const scene = SkyScene.create({
          container: node,
          showGrid: true,
          initialFov: 65,
          onSelectBody,
          onFovChange,
          onContextLost: () => setContextLost(true),
          onContextRestored: () => setContextLost(false),
        });
        sceneRef.current = scene;
        setStatus('ready');
        return () => {
          scene.dispose();
          if (sceneRef.current === scene) {
            sceneRef.current = null;
          }
        };
      } catch (error) {
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'راه‌اندازی نمای آسمان ناموفق بود.',
        );
        return undefined;
      }
    },
    [onFovChange, onSelectBody, sceneRef, support.supported],
  );

  const handleRetry = (): void => {
    setStatus('loading');
    setErrorMessage(null);
    setContextLost(false);
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    sceneRef.current?.setLowPower(lowPower);
  }, [lowPower, sceneRef, status]);

  useEffect(() => {
    if (snapshot) {
      sceneRef.current?.updateSnapshot(snapshot);
    }
  }, [sceneRef, snapshot, status]);

  useEffect(() => {
    sceneRef.current?.setSelectedBody(selectedBodyId);
  }, [sceneRef, selectedBodyId, status]);

  const lastAimRef = useRef<{ scene: SkyScene | null; bodyId: string | null }>({
    scene: null,
    bodyId: null,
  });

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !snapshot) return;
    if (lastAimRef.current.scene === scene && lastAimRef.current.bodyId === selectedBodyId) {
      return;
    }
    lastAimRef.current = { scene, bodyId: selectedBodyId };
    const position = snapshot.positions.find((item) => item.bodyId === selectedBodyId);
    if (position?.isAboveHorizon) {
      scene.lookAtHorizontal(position.horizontal);
    }
  }, [sceneRef, selectedBodyId, snapshot, status]);

  useEffect(() => {
    sceneRef.current?.setShowGrid(showGrid);
  }, [sceneRef, showGrid, status]);

  useEffect(() => {
    sceneRef.current?.setCameraOverlayActive(cameraOverlayActive);
  }, [cameraOverlayActive, sceneRef, status]);

  useEffect(() => {
    sceneRef.current?.setFov(fov);
  }, [fov, sceneRef, status]);

  return (
    <>
      <div
        key={attempt}
        className="sky-viewport"
        ref={attachScene}
        data-testid="sky-viewport"
      />

      {effectiveStatus === 'loading' ? (
        <div className="scene-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>در حال آماده‌سازی آسمان…</p>
        </div>
      ) : null}

      {effectiveStatus === 'error' ? (
        <div className="scene-overlay-center">
          <SceneFallback
            title="نمای آسمان ساخته نشد"
            message={effectiveError ?? 'WebGL در دسترس نیست.'}
            extra="موقعیت‌های علمی همچنان از طریق فهرست اجرام قابل مطالعه‌اند. برای دیدن آسمان سه‌بعدی، مرورگری با WebGL و شتاب سخت‌افزاری فعال استفاده کنید."
            onRetry={support.supported ? handleRetry : undefined}
          />
        </div>
      ) : null}

      {contextLost && effectiveStatus === 'ready' ? (
        <div className="scene-overlay-center">
          <div className="scene-fallback glass" role="alert">
            <h2>اتصال گرافیکی موقتاً قطع شد</h2>
            <p>در حال تلاش برای بازیابی نمای آسمان.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
