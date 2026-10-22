import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile web document configuration', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const layoutCss = readFileSync(
    resolve(process.cwd(), 'src/styles/layout.css'),
    'utf8',
  );
  const skyCss = readFileSync(resolve(process.cwd(), 'src/styles/sky.css'), 'utf8');
  const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

  it('declares a responsive viewport and Persian RTL document', () => {
    expect(html).toContain('<html lang="fa" dir="rtl">');
    expect(html).toContain('width=device-width');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('name="theme-color"');
  });

  it('defines mobile-first and safe-area aware layout rules', () => {
    expect(layoutCss).toContain('100dvh');
    expect(tokensCss).toContain('env(safe-area-inset-bottom');
    expect(layoutCss).toContain('@media (min-width: 760px)');
    expect(layoutCss).toContain('@media (max-width: 379px)');
    expect(skyCss).toContain('@media (min-width: 760px)');
  });

  it('prevents accidental page-level scrolling/zooming in the 3D canvas', () => {
    expect(layoutCss).toContain('touch-action: none');
    expect(layoutCss).toContain('overflow: hidden');
  });
});
