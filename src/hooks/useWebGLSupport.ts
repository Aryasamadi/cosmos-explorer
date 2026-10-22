import { useState } from 'react';
import { detectWebGLSupport, type WebGLSupport } from '../engine/shared/webgl';

export function useWebGLSupport(): WebGLSupport {
  const [support] = useState<WebGLSupport>(() => detectWebGLSupport());
  return support;
}
