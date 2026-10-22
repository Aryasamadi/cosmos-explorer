export interface WebGLSupport {
  supported: boolean;
  version: 1 | 2 | null;
  reasonFa?: string;
}

export function detectWebGLSupport(doc: Document = document): WebGLSupport {
  if (typeof document === 'undefined' || !doc?.createElement) {
    return { supported: false, version: null, reasonFa: 'محیط مرورگر در دسترس نیست.' };
  }
  const canvas = doc.createElement('canvas');
  try {
    const context =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (!context) {
      return {
        supported: false,
        version: null,
        reasonFa: 'مرورگر یا سخت‌افزار این دستگاه WebGL را در اختیار برنامه قرار نمی‌دهد.',
      };
    }
    const version = typeof WebGL2RenderingContext !== 'undefined' &&
      context instanceof WebGL2RenderingContext
      ? 2
      : 1;
    const loseContext = context.getExtension('WEBGL_lose_context');
    loseContext?.loseContext();
    return { supported: true, version };
  } catch {
    return {
      supported: false,
      version: null,
      reasonFa: 'راه‌اندازی WebGL با خطا روبه‌رو شد. شتاب سخت‌افزاری مرورگر را بررسی کنید.',
    };
  }
}
