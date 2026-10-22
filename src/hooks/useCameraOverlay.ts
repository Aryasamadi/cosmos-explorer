import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'paused' | 'denied' | 'error' | 'unsupported';

export interface UseCameraOverlayResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  messageFa: string | null;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

function describeCameraError(error: unknown): { status: CameraStatus; messageFa: string } {
  const name = error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        status: 'denied',
        messageFa:
          'اجازهٔ دسترسی به دوربین داده نشد. می‌توانید بدون لایهٔ دوربین از آسمان استفاده کنید.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        status: 'error',
        messageFa: 'دوربین پسین روی این دستگاه پیدا نشد.',
      };
    case 'NotReadableError':
    case 'AbortError':
      return {
        status: 'error',
        messageFa: 'دوربین در دسترس نیست یا برنامهٔ دیگری از آن استفاده می‌کند.',
      };
    default:
      return {
        status: 'error',
        messageFa: 'راه‌اندازی دوربین ناموفق بود؛ برنامه بدون لایهٔ دوربین ادامه می‌دهد.',
      };
  }
}

export function useCameraOverlay(): UseCameraOverlayResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [messageFa, setMessageFa] = useState<string | null>(null);

  const releaseStream = useCallback((): void => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const stop = useCallback((): void => {
    releaseStream();
    if (!mountedRef.current) return;
    setStatus('idle');
    setMessageFa(null);
  }, [releaseStream]);

  const start = useCallback(async (): Promise<void> => {
    if (streamRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setMessageFa(
        'این مرورگر دسترسی به دوربین را پشتیبانی نمی‌کند یا صفحه در بستر امن (HTTPS) باز نشده است.',
      );
      return;
    }

    setStatus('requesting');
    setMessageFa(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (!mountedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      const video = videoRef.current;
      if (!video) {
        for (const track of stream.getTracks()) track.stop();
        setStatus('error');
        setMessageFa('نمایشگر تصویر دوربین در دسترس نیست.');
        return;
      }
      streamRef.current = stream;
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => {
          releaseStream();
          if (mountedRef.current) {
            setStatus('error');
            setMessageFa('اتصال دوربین قطع شد. می‌توانید دوباره تلاش کنید.');
          }
        });
      }
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      if (!mountedRef.current) {
        releaseStream();
        return;
      }
      setStatus('active');
      setMessageFa(null);
    } catch (error) {
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      if (!mountedRef.current) return;
      const description = describeCameraError(error);
      setStatus(description.status);
      setMessageFa(description.messageFa);
    }
  }, [releaseStream]);

  useEffect(() => {
    mountedRef.current = true;
    const handleVisibilityChange = (): void => {
      const video = videoRef.current;
      const stream = streamRef.current;
      if (!video || !stream) return;
      if (document.hidden) {
        video.pause();
        setStatus('paused');
        setMessageFa('تصویر دوربین در پس‌زمینه متوقف شد و با بازگشت ادامه می‌یابد.');
        return;
      }
      const tracksEnded = stream.getTracks().some((track) => track.readyState === 'ended');
      if (tracksEnded) {
        releaseStream();
        setStatus('error');
        setMessageFa('پس از بازگشت، جریان دوربین در دسترس نبود. دوباره تلاش کنید.');
        return;
      }
      void video
        .play()
        .then(() => {
          setStatus('active');
          setMessageFa(null);
        })
        .catch(() => {
          releaseStream();
          setStatus('error');
          setMessageFa('پخش دوبارهٔ تصویر دوربین پس از بازگشت ممکن نشد.');
        });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseStream();
    };
  }, [releaseStream]);

  return {
    videoRef,
    status,
    messageFa,
    isActive: status === 'active' || status === 'paused' || status === 'requesting',
    start,
    stop,
  };
}
